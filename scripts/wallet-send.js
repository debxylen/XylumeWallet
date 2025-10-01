if (typeof wallet === 'undefined') throw new Error('Wallet not initialized yet');

const activeTxWatchers = {};
let selectedToken;

// 🧼 On page ready
window.addEventListener("DOMContentLoaded", () => {
  initSendFlow();

  selectedToken = { symbol: "XYL", name: "Xylume", address: null, isNative: true };

  document.querySelectorAll("#tokenSelector").forEach(el => el.onclick = showTokenPicker);

  getStoredTxs().reverse().forEach(tx => {
    if (tx.status == "pending") {
      addPendingTx(tx.to, ethers.BigNumber.from(tx.amount), tx.symbol, tx.hash, tx.gasLimit, tx.nonce, false);
      trackTxStatus(tx.hash);
    } else {
      addPendingTx(tx.to, ethers.BigNumber.from(tx.amount), tx.symbol, tx.hash, tx.gasLimit, tx.nonce, false);
      updateTxStatus(tx.hash, tx.status, false);
    }
  });
});

function seedSendModal() {
  const nonceInput = document.getElementById("tx-nonce");
  const gasDisplay = document.getElementById("current-gas");
  const gasSlider = document.getElementById("gas-price-slider");
  const gasLimit = document.getElementById("gas-limit");

  nonceInput.placeholder = 'Fetching...';
  provider.getTransactionCount(wallet.address, "latest").then(nonce => {
    nonceInput.value = nonce;
    nonceInput.placeholder = '';
  });

  gasDisplay.textContent = 'Fetching...';
  provider.getGasPrice().then(gasPrice => {
    gasSlider.value = gasPrice;
    gasSlider.dispatchEvent(new Event("input", { bubbles: true }));
  });

  gasLimit.placeholder = 'Fetching...';
  provider.estimateGas({ // mock
    to: "0x2C0ce11bC9B0849781F7008db708E50EE1714Df7",
    data: "0x",
    value: 1_000_000_000_000_000_000n, // 1 XYL
  }).then(gasUnits => {
    gasLimit.value = gasUnits;
    gasLimit.placeholder = '';
  });
}
document.querySelector("#sendBtn").onclick = seedSendModal;

function showTokenPicker() {
  const modal = document.getElementById("tokenPickerModal");
  const list = document.getElementById("tokenPickerList");
  modal.classList.remove("hidden");
  list.innerHTML = "";

  const allTokens = [
    { symbol: "XYL", name: "Xylume", isNative: true, address: null },
    { symbol: "wxei", name: "wxei (1e-18 XYL)", isNative: true, address: null },
    ...JSON.parse(localStorage.getItem("xyl_tokens") || "[]").map(t => ({ ...t, isNative: false }))
  ];

  allTokens.forEach(token => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer";
    div.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <i class="ri-coin-line text-sm"></i>
        </div>
        <div>
          <h3 class="font-medium text-sm">${token.symbol}</h3>
          <p class="text-xs text-gray-400">${token.name}</p>
        </div>
      </div>
    `;
    div.onclick = () => {
      selectedToken = token;
      document.querySelectorAll("#selectedTokenSymbol").forEach(el => el.textContent = token.symbol);
      modal.classList.add("hidden");
    };
    list.appendChild(div);
  });

  document.getElementById("closeTokenPicker").onclick = () => {
    modal.classList.add("hidden");
  };
}
function initSendFlow() {
  const sendBtn = document.getElementById("sendBtn");
  const sendModal = document.getElementById("sendModal");
  const nextBtn = document.getElementById("sendTxBtn");

  nextBtn.addEventListener("click", async () => {
    try {
      showLoader();
      const txData = await gatherSendData();
      hideLoader();
      showLoader();
      showPreviewModal(txData);
      hideLoader();
    } catch (e) {
      hideLoader();
      console.error(e);
      showToast("Error", e.message || e, 5000);
    }
  });
}

// 📥 Grab and validate form inputs
async function gatherSendData() {
  const to = document.querySelector('#sendModal input[placeholder^="0x"]').value.trim();
  const unit = selectedToken.symbol;
  let amount;
  const amountRaw = document.querySelector('#sendModal input[placeholder="0.0"]').value.trim();
  const hexData = document.querySelector('#sendModal textarea').value.trim();

  if (!ethers.utils.isAddress(to)) return showToast("Invalid Address", "Recipient must be a valid 0x address");
  if (isNaN(parseFloat(amountRaw)) || parseFloat(amountRaw) < 0) return showToast("Invalid Amount", "Enter a number greater than or equal to 0");

  if (selectedToken.isNative) {
    amount = unit === 'XYL' ? ethers.utils.parseEther(amountRaw) : ethers.BigNumber.from(amountRaw);
  } else {
    amount = ethers.utils.parseEther(amountRaw); // non-native or token input is never taken in wxei
  }


  // TO DO: Maybe remove custom nonce, gas estimate, gas price to make things simpler for me as well as regular UX
  const gasPrice = document.getElementById("gas-price-slider").value;
  const nonce = document.getElementById("tx-nonce").value;
  const gasEstimate = document.getElementById("gas-limit").value;
  if (!(gasPrice && nonce && gasEstimate)) throw Error("Invalid inputs");
  /*
  let nonce;
  try {
    nonce = await provider.getTransactionCount(wallet.address, "latest");
  } catch (e) {
    console.error(e);
    return showToast("Nonce Error", e.message);
  }

  let gasEstimate;
  try {
    gasEstimate = await walletWithProvider.estimateGas({ to, value: amount, data: hexData || "0x" });
  } catch (e) {
    console.error(e);
    return showToast("Gas Estimation Failed", e.message);
  }
  */

  return { to, token: selectedToken, amount, amountRaw, data: hexData || "0x", nonce, gasLimit: gasEstimate, gasPrice };
}

function showPreviewModal({ to, token, amount, amountRaw, data, nonce, gasLimit, gasPrice }) {
  const sendModal = document.getElementById("sendModal");
  sendModal.querySelector(".space-y-4").classList.add("hidden");

  let preview = document.getElementById("txPreview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "txPreview";
    preview.className = "space-y-4";

    preview.innerHTML = `
      <div class="border border-gray-800 rounded-lg p-4 bg-gray-900/50 space-y-2 text-sm text-gray-300">
        ${token.isNative ? '' : '<p class="text-lg"><strong>Token Transfer</strong></p>'}
        <p><strong>To:</strong> <span id="previewTo"></span></p>
        <p><strong>Amount:</strong> <span id="previewAmount"></span></p>
        <p><strong>Nonce:</strong> <span id="previewNonce"></span></p>
        <p><strong>Total Gas:</strong> <span id="previewGas"></span></p>
        ${token.isNative ? '<p><strong>Hex Data:</strong> <span id="previewData"></span></p>' : ''}
      </div>
      <div class="flex gap-3">
        <button id="previewBackBtn" class="flex-1 py-3 rounded-button bg-gray-800 text-white border border-gray-600 hover:bg-gray-700">Back</button>
        <button id="previewConfirmBtn" class="flex-1 py-3 rounded-button bg-primary text-black hover:opacity-90">Confirm</button>
      </div>
    `;

    sendModal.querySelector(".modal-content").appendChild(preview);
  }

  // fill preview values
  document.getElementById("previewTo").textContent = to;
  document.getElementById("previewAmount").textContent = `${amountRaw} ${token.symbol}`;
  document.getElementById("previewNonce").textContent = nonce;
  document.getElementById("previewGas").textContent = `${ethers.utils.formatEther(gasLimit).toString()} XYL`;
  if (token.isNative) document.getElementById("previewData").textContent = data || "0x";

  preview.classList.remove("hidden");

  // handle confirm click
  document.getElementById("previewConfirmBtn").onclick = () => {
    preview.remove();
    processTransaction({
      to,
      amount,
      token,
      nonce,
      gasLimit,
      gasPrice,
      data
    });
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
    sendModal.classList.add("hidden");
  };

  // handle back click
  document.getElementById("previewBackBtn").onclick = () => {
    preview.remove();
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
  };
}

function showCancelModal({ hash, nonce }) {
  const sendModal = document.getElementById("sendModal");
  sendModal.querySelector(".space-y-4").classList.add("hidden");

  let cancelPreview = document.getElementById("cancelPreview");
  if (!cancelPreview) {
    cancelPreview = document.createElement("div");
    cancelPreview.id = "cancelPreview";
    cancelPreview.className = "space-y-4";

    cancelPreview.innerHTML = `
      <div class="border border-gray-800 rounded-lg p-4 bg-gray-900/50 space-y-2 text-sm text-gray-300">
        <p><strong>Cancel Transaction</strong></p>
        <p class="text-gray-400">This will send a 0 XYL transaction to yourself with nonce <strong>${nonce}</strong> to invalidate the pending one.</p>
      </div>
      <div class="flex gap-3">
        <button id="cancelBackBtn" class="flex-1 py-3 rounded-button bg-gray-800 text-white border border-gray-600 hover:bg-gray-700">Back</button>
        <button id="cancelConfirmBtn" class="flex-1 py-3 rounded-button bg-red-500 text-white hover:opacity-90">Confirm Cancel</button>
      </div>
    `;

    sendModal.querySelector(".modal-content").appendChild(cancelPreview);
  }

  cancelPreview.classList.remove("hidden");

  document.getElementById("cancelConfirmBtn").onclick = () => {
    cancelPreview.remove();
    replaceTx(hash, nonce, wallet.address, 0, 'XYL');
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
    sendModal.classList.add("hidden");
  };

  document.getElementById("cancelBackBtn").onclick = () => {
    cancelPreview.remove();
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
  };
}

function showReplaceModal({ hash, nonce }) {
  const sendModal = document.getElementById("sendModal");
  sendModal.querySelector(".space-y-4").classList.add("hidden");

  let replaceBox = document.getElementById("replaceBox");
  if (!replaceBox) {
    replaceBox = document.createElement("div");
    replaceBox.id = "replaceBox";
    replaceBox.className = "space-y-4";

    replaceBox.innerHTML = `
      <div class="border border-gray-800 rounded-lg p-4 bg-gray-900/50 space-y-2 text-sm text-gray-300">
        <p><strong>Replace Transaction</strong></p>
        <label class="block mb-2 text-gray-400">Recipient Address</label>
        <input id="replaceTo" type="text" placeholder="0x..." class="w-full rounded-md p-2 bg-gray-800 text-white text-sm" />
        <label class="block mb-2 text-gray-400">Amount</label>
        <div class="relative">
          <input type="text" id="replaceAmt"
            class="w-full bg-gray-900 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary border border-gray-800"
            placeholder="0.0">
            <div id="tokenSelector" onclick="showTokenPicker()" class="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-800 rounded-lg px-2 py-1 border border-gray-700 cursor-pointer flex items-center gap-2">
              <span id="selectedTokenSymbol">XYL</span>
              <i class="ri-arrow-down-s-line text-sm"></i>
            </div>
        </div>
        <textarea id="replaceData" placeholder="Optional hex data (0x...)" class="w-full rounded-md p-2 bg-gray-800 text-white text-sm"></textarea>
      </div>
      <div class="flex gap-3">
        <button id="replaceBackBtn" class="flex-1 py-3 rounded-button bg-gray-800 text-white border border-gray-600 hover:bg-gray-700">Back</button>
        <button id="replaceConfirmBtn" class="flex-1 py-3 rounded-button bg-yellow-500 text-black hover:opacity-90">Confirm Replace</button>
      </div>
    `;

    sendModal.querySelector(".modal-content").appendChild(replaceBox);
  }

  replaceBox.classList.remove("hidden");

  document.getElementById("replaceConfirmBtn").onclick = async () => {
    const to = document.getElementById("replaceTo").value.trim();
    const amt = document.getElementById("replaceAmt").value.trim();
    const unit = selectedToken.symbol;
    let amount;
    const data = document.getElementById("replaceData").value.trim() || "0x";

    if (!ethers.utils.isAddress(to)) return showToast("Invalid Address", "Recipient must be a valid 0x address");
    if (isNaN(parseFloat(amt)) || parseFloat(amt) < 0) return showToast("Invalid Amount", "Enter a number greater than or equal to 0");

    if (selectedToken.isNative) {
      amount = unit === 'XYL' ? ethers.utils.parseEther(amt) : ethers.BigNumber.from(amt);
    } else {
      amount = ethers.utils.parseEther(amt); // non-native or token input is never taken in wxei
    }

    replaceBox.remove();
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
    sendModal.classList.add("hidden");
    replaceTx(hash, nonce, to, amount, selectedToken, data);
  };

  document.getElementById("replaceBackBtn").onclick = () => {
    replaceBox.remove();
    sendModal.querySelector(".space-y-4").classList.remove("hidden");
    sendModal.classList.add("hidden");
  };
}

// 🚀 Send TX, show states
async function processTransaction({ to, amount, token, nonce, gasLimit, gasPrice, data }) {
  showLoader();
  let tx;

  if (token.isNative) {
    // Native XYL
    tx = {
      to,
      value: ethers.BigNumber.from(amount),
      gasLimit: ethers.BigNumber.from(gasLimit),
      gasPrice: ethers.BigNumber.from(gasPrice),
      nonce: ethers.BigNumber.from(nonce),
      data: data || "0x",
      chainId: CHAIN_ID
    };
  } else {
    // Token send = call contract with encoded `transfer`
    const tokenContract = new ethers.Contract(token.address, [
      "function transfer(address to, uint256 amount) public returns (bool)"
    ], walletWithProvider);

    data = tokenContract.interface.encodeFunctionData("transfer", [to, amount]);

    tx = {
      to: token.address,
      value: ethers.BigNumber.from(0), // no native value sent
      gasLimit: ethers.BigNumber.from(gasLimit),
      gasPrice: ethers.BigNumber.from(gasPrice),
      nonce: ethers.BigNumber.from(nonce),
      data,
      chainId: CHAIN_ID
    };
  }

  let signedTx;
  try {
    signedTx = await walletWithProvider.signTransaction(tx);
  } catch (e) {
    console.error(e);
    hideLoader();
    return showToast("Signing Failed", e.message);
  }

  addSendingTx(to, amount, token.isNative ? 'XYL' : token.symbol);

  let sendRes;
  try {
    sendRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] })
    });
  } catch (e) {
    removeSendingTx();
    hideLoader();
    console.error(e);
    return showToast("RPC Error", e.message);
  }

  const res = await sendRes.json();
  removeSendingTx();

  if (res.error) { 
    console.error(res.error);
    hideLoader();
    return showToast("Broadcast Failed", res.error.message)
  };

  const txHash = res.result;
  addPendingTx(to, amount, token.isNative ? 'XYL' : token.symbol, txHash, gasLimit, nonce, true);
  showToast("Transaction Sent", `<a href="https://debxylen.github.io/XylumeExplorer/tx.html?hash=${txHash}" target="_blank">View on Explorer</a>`);
  trackTxStatus(txHash);
  hideLoader();
}

// 🔄 Track TX status every 0.5s
async function trackTxStatus(txHash, silent = false) {
  activeTxWatchers[txHash] = { cancel: false };

  while (true) {
    if (activeTxWatchers[txHash].cancel) return -1;
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash]
      })
    });

    const response = await res.json();
    const result = response.result;

    if (result) {
      if (result.status === "0x1") {
        updateTxStatus(txHash, "confirmed");
        loadBalance();
        updateAllTokenBalances();
        if (!silent) showToast("Transaction Confirmed", `<a href="https://debxylen.github.io/XylumeExplorer/tx.html?hash=${txHash}" target="_blank">View on Explorer</a>`);
        activeTxWatchers[txHash].cancel = true;
        return 1;
      } else if (result.status === "0x0") {
        updateTxStatus(txHash, "failed");
        loadBalance();
        updateAllTokenBalances();
        if (!silent) showToast("Transaction Failed", `<a href="https://debxylen.github.io/XylumeExplorer/tx.html?hash=${txHash}" target="_blank">View on Explorer</a>`);
        activeTxWatchers[txHash].cancel = true;
        return 0;
      }
    }

    await new Promise(res => setTimeout(res, 500));
  }
}

function cancelTxWatcher(txHash) {
  if (activeTxWatchers[txHash]) {
    activeTxWatchers[txHash].cancel = true;
  }
}

// 📦 UI part
function addSendingTx(to, amount, symbol) {
  const txContainer = document.getElementById("transactions");
  const short = `${to.slice(0, 6)}...${to.slice(-4)}`;

  const html = `
    <div class="p-4 hover:bg-gray-800 rounded-lg sending-tx" data-sending data-hash="0x">
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center animate-pulse">
            <i class="ri-loader-4-line text-gray-400 animate-spin"></i>
          </div>
          <div>
            <h3 class="font-medium">Sending...</h3>
            <p class="text-sm text-gray-400">To: ${short}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-medium">-${ethers.utils.formatEther(amount)} ${symbol}</p>
          <p class="text-sm text-gray-400">Broadcasting</p>
        </div>
      </div>
    </div>
  `;
  txContainer.insertAdjacentHTML("afterbegin", html);
}

function removeSendingTx() {
  const sending = document.querySelector("[data-sending]");
  if (sending) sending.remove();
}

function addPendingTx(to, amount, symbol, txHash, gasLimit, nonce, save = true) {
  const txContainer = document.getElementById("transactions");
  const short = `${to.slice(0, 6)}...${to.slice(-4)}`;
  const explorerURL = `https://debxylen.github.io/XylumeExplorer/tx.html?hash=${txHash}`;

  const html = `
    <div class="p-4 hover:bg-gray-800 rounded-lg" data-nonce="${nonce}" data-hash="${txHash}">
      <a href="${explorerURL}" target="_blank" class="block">
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <i class="ri-arrow-up-line text-yellow-500"></i>
            </div>
            <div>
              <h3 class="font-medium">Sent</h3>
              <p class="text-sm text-gray-400">To: ${short}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-medium">-${ethers.utils.formatEther(amount)} ${symbol}</p>
            <p class="text-sm text-yellow-500">Pending</p>
          </div>
        </div>
      </a>
      <div class="flex gap-2 mt-2">
        <button class="cancel-tx-btn text-sm px-4 py-2 rounded-button bg-red-500/20 text-red-500 hover:bg-red-500/30 cursor-pointer whitespace-nowrap">Cancel</button>
        <button class="replace-tx-btn text-sm px-4 py-2 rounded-button bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 cursor-pointer whitespace-nowrap">Replace</button>
      </div>
    </div>
  `;
  txContainer.insertAdjacentHTML("afterbegin", html);
  if (save) saveTx({to, amount, symbol, hash: txHash, gasLimit: gasLimit.toString(), nonce, status: "pending"});

  document.querySelectorAll(".cancel-tx-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const el = e.target.closest("[data-hash]");
      const elHash = el.getAttribute("data-hash");
      const elNonce = el.getAttribute("data-nonce");
      document.getElementById("sendModal").classList.remove("hidden");
      showCancelModal({ hash: elHash, nonce: elNonce });
    });
  });

  document.querySelectorAll(".replace-tx-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const el = e.target.closest("[data-hash]");
      const elHash = el.getAttribute("data-hash");
      const elNonce = el.getAttribute("data-nonce");
      document.getElementById("sendModal").classList.remove("hidden");
      showReplaceModal({ hash: elHash, nonce: elNonce });
    });
  });
}

function removeTxUI(hash) {
  const txEl = document.querySelector(`[data-hash="${hash}"]`);
  if (txEl) txEl.remove();
}

function updateTxStatus(txHash, status, updateSaves = true) {
  const txEl = document.querySelector(`[data-hash="${txHash}"]`);
  if (!txEl) return;

  const icon = txEl.querySelector("i");
  const iconBox = txEl.querySelector(".w-10");
  const statusText = txEl.querySelector(".text-right").querySelector(".text-sm");
  const btns = txEl.querySelector(".flex.gap-2.mt-2");
  if (btns) btns.remove();

  if (status === "confirmed") {
    iconBox.classList.replace("bg-yellow-500/20", "bg-green-500/20");
    icon.classList.replace("text-yellow-500", "text-green-500");
    statusText.textContent = "Confirmed";
    statusText.classList.replace("text-yellow-500", "text-green-500");
    if (updateSaves) updateSavedTx(txHash, "confirmed");
  } else if (status === "failed") {
    iconBox.classList.replace("bg-yellow-500/20", "bg-red-500/20");
    icon.classList.replace("text-yellow-500", "text-red-500");
    statusText.textContent = "Failed";
    statusText.classList.replace("text-yellow-500", "text-red-500");
    if (updateSaves) updateSavedTx(txHash, "failed");
  }
}

async function replaceTx(hash, nonce, newTo, newAmount, token, newData = "0x") { // TO REMOVE IN V4
  let savedTx = getSavedTx(hash);
  let isNative;
  if (typeof token == "string") {
    isNative = true;
  } else {
    isNative = token.isNative;
  }

  let to, value, data;

  if (isNative) {
    to = newTo;
    value = ethers.BigNumber.isBigNumber(newAmount)
      ? newAmount.toHexString()
      : ethers.BigNumber.from(newAmount).toHexString();
    data = newData || "0x";
  } else {
    const iface = new ethers.utils.Interface([
      "function transfer(address to, uint256 amount)"
    ]);
    to = token.address;
    value = "0x0";
    data = iface.encodeFunctionData("transfer", [newTo, newAmount]);
  }

  const tx = {
    to,
    value,
    gasLimit: ethers.BigNumber.isBigNumber(savedTx.gasLimit)
      ? savedTx.gasLimit.toHexString()
      : ethers.BigNumber.from(savedTx.gasLimit).toHexString(),
    gasPrice: "0x1",
    nonce: Number(nonce),
    data,
    chainId: CHAIN_ID
  };

  const signed = await walletWithProvider.signTransaction(tx);

  showLoader();
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendRawTransaction",
      params: [signed]
    })
  });

  const json = await res.json();
  hideLoader();

  if (json.error) {
    console.error(json.error);
    return showToast("Transaction Rejected", json.error.message);
  }

  const txHash = json.result;
  removeTxUI(hash);
  removeSavedTx(hash);
  cancelTxWatcher(hash);
  addPendingTx(newTo, newAmount, isNative ? 'XYL' : token.symbol, txHash, savedTx.gasLimit, nonce, true);
  trackTxStatus(txHash);
}

// 🍞 Basic toast
function showToast(title, message, duration = 5000) {
  const toast = document.getElementById("toast");
  if (!toast.classList.contains("hidden")) { // a toast is already being shown
    toast.classList.add("hidden");
  }
  document.getElementById("toasth4").innerHTML = title;
  document.getElementById("toastp").innerHTML = message;
  toast.classList.remove("hidden");
  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

// 💾 Persistence
function saveTx(tx) {
  const txs = JSON.parse(localStorage.getItem("xyl_txs") || "[]");
  const sanitizedTx = {
    ...tx,
    amount: tx.amount.toString(), // BigNumber -> string
  };
  txs.unshift(sanitizedTx);
  localStorage.setItem("xyl_txs", JSON.stringify(txs));
}

function removeSavedTx(hash) {
  const txs = JSON.parse(localStorage.getItem("xyl_txs") || "[]");
  const filtered = txs.filter(tx => tx.hash !== hash);
  localStorage.setItem("xyl_txs", JSON.stringify(filtered));
}

// update saved tx status
function updateSavedTx(hash, newStatus) {
  const txs = JSON.parse(localStorage.getItem("xyl_txs") || "[]");
  const updated = txs.map(tx => {
    if (tx.hash === hash) {
      return { ...tx, status: newStatus };
    }
    return tx;
  });
  localStorage.setItem("xyl_txs", JSON.stringify(updated));
}

function getStoredTxs() {
  return JSON.parse(localStorage.getItem("xyl_txs") || "[]");
}

function getSavedTx(hash) {
  const txs = JSON.parse(localStorage.getItem("xyl_txs") || "[]");
  return txs.find(tx => tx.hash === hash) || null;
}
