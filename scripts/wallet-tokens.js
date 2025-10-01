if (typeof wallet === 'undefined') throw new Error('Wallet not initialized yet');

let addBtnTimeout;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

// 🧼 On page ready
window.addEventListener("DOMContentLoaded", () => {
  // 🧪 Add native token (address normalized to lowercase)
  addTokenUI("XYL", "Xylume (Native)", wallet.address.toLowerCase(), '-', true);
  loadBalance();

  // show for 5s on load
  setTimeout(() => hideAddBtn(), 5000);
  showAddBtn();

  document.getElementById("addTokenWrapper").addEventListener("mouseenter", () => {
    clearTimeout(addBtnTimeout);
    showAddBtn();
  });

  document.getElementById("addTokenWrapper").addEventListener("mouseleave", () => {
    clearTimeout(addBtnTimeout);
    addBtnTimeout = setTimeout(hideAddBtn, 200);
  });

  document.getElementById("addTokenConfirmBtn").onclick = startAddTokenFlow;

  // ensure stored token addresses are passed in lowercase
  getStoredTokens().reverse().forEach(token => {
    addTokenUI(token.symbol, token.name, (token.address || "").toLowerCase());
  });

  updateAllTokenBalances();
  setInterval(updateAllTokenBalances, 10000); // every 10s
});

function showAddBtn() {
  const addBtn = document.getElementById("addTokenBtn");
  addBtn.style.right = "0"; // visible
}

function hideAddBtn() {
  const addBtn = document.getElementById("addTokenBtn");
  addBtn.style.right = "-60px"; // slide out
}

async function startAddTokenFlow() {
  showLoader();
  const modal = document.getElementById("addTokenModal");
  const modalContent = modal.querySelector(".space-y-4");

  const address = modalContent.querySelector("#newTokenAddress").value.trim().toLowerCase();

  if (!ethers.utils.isAddress(address)) {
    hideLoader();
    return showToast("Invalid token address");
  }

  if (getStoredTokens().some(t => (t.address || "").toLowerCase() === address)) {
    hideLoader();
    return showToast("Token Already Added", "This token is already in your token list.");
  }

  // Fetch token data
  const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);

  let name, symbol, rawBalance;
  try {
    [name, symbol, rawBalance] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.balanceOf(wallet.address)
    ]);
  } catch (e) {
    console.error(e);
    hideLoader();
    return showToast("Token contract call failed", e.message || e);
  }

  const balance = ethers.utils.formatUnits(rawBalance, 18);

  // hide old form
  modalContent.classList.add("hidden");

  // build preview
  let preview = document.getElementById("tokenPreviewBox");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "tokenPreviewBox";
    preview.className = "space-y-4";

    preview.innerHTML = `
      <div class="flex items-center justify-between p-4 rounded-lg" style="background: linear-gradient(
        to bottom right,
        rgba(17, 24, 39, 0.9),   /* gray-900 with 10% opacity */
        rgba(26, 16, 51, 0.9),   /* #1a1033 with 10% opacity */
        rgba(45, 27, 69, 0.9)    /* #2d1b45 with 10% opacity */
      );
      backdrop-filter: blur(12px); /* ~backdrop-blur-lg */
      ">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <i class="ri-coin-line text-xl"></i>
          </div>
          <div>
            <h3 id="tokenSymbol" class="font-medium">${symbol}</h3>
            <p id="tokenName" class="text-sm text-gray-400">${name}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-medium" id="tokenBalance">${balance} ${symbol}</p>
          <p class="text-sm text-gray-400">$0</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="cancelAddTokenBtn" class="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600">Cancel</button>
        <button id="confirmAddTokenBtn" class="flex-1 bg-primary text-black py-2 rounded-lg hover:opacity-90">Add Token</button>
      </div>
    `;
    modal.querySelector(".modal-content").appendChild(preview);
  }

  preview.classList.remove("hidden");

  // cancel handler
  document.getElementById("cancelAddTokenBtn").onclick = () => {
    preview.remove();
    modalContent.classList.remove("hidden");
  };

  // confirm handler
  document.getElementById("confirmAddTokenBtn").onclick = () => {
    addTokenUI(symbol, name, address, balance);
    saveToken(address, name, symbol); // saveToken already lowercases address
    preview.remove();
    modalContent.classList.remove("hidden");
    modal.classList.add("hidden");
    modalContent.querySelector("#newTokenAddress").value = "";
  };
  hideLoader();
}

// Add tokens to UI
function addTokenUI(symbol, name, address, initialBalance = '-', isNative = false) {
  // normalize address to lowercase immediately
  const normalizedAddress = (address || "").toLowerCase();

  const container = document.getElementById("tokens");
  const tokenDiv = document.createElement("div");
  tokenDiv.dataset.address = normalizedAddress;
  tokenDiv.dataset.native = isNative;
  tokenDiv.className = 'flex items-center justify-between p-4 hover:bg-gray-800 rounded-lg cursor-pointer';
  tokenDiv.onclick = () => {
    const url = `https://debxylen.github.io/XylumeExplorer/address.html?address=${normalizedAddress}`;
    window.open(url, '_blank');
  };
  tokenDiv.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    document.getElementById("tokenCtxModal").classList.remove('hidden');
    document.getElementById("removeTokenBtn").addEventListener('click', function (event) {
      removeSavedToken(normalizedAddress);
      tokenDiv.remove();
    });
  });
  tokenDiv.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
        <i class="ri-coin-line text-xl"></i>
      </div>
      <div>
        <h3 id="tokenSymbol" class="font-medium">${symbol}</h3>
        <p id="tokenName" class="text-sm text-gray-400">${name}</p>
      </div>
    </div>
    <div class="text-right">
      <p class="font-medium" ${isNative ? "id='xylBalance'" : "id='tokenBalance'"}>${initialBalance} ${symbol}</p>
      <p class="text-sm text-gray-400" ${isNative ? "id='usdBalance'" : ""}>$0</p>
    </div>
  `;
  container.appendChild(tokenDiv);
}

async function updateTokenBalance(address) {
  // ensure address lookup uses lowercase
  const tokenEl = document.getElementById("tokens").querySelector(`[data-address="${(address || "").toLowerCase()}"]`);
  if (!tokenEl) return;

  const contract = new ethers.Contract(address, ERC20_ABI, provider);
  const balance = await contract.balanceOf(wallet.address);
  const formatted = ethers.utils.formatUnits(balance, 18);

  const symbol = tokenEl.querySelector("#tokenSymbol").textContent;
  const balanceText = `${formatted} ${symbol}`;
  tokenEl.querySelector("#tokenBalance").textContent = balanceText;
}

async function updateAllTokenBalances() {
  const tokenEls = document.getElementById("tokens").querySelectorAll("[data-address]:not([data-native='true'])");

  for (const el of tokenEls) {
    const address = el.getAttribute("data-address");
    updateTokenBalance(address); // nonblocking
  }
}

function getStoredTokens() {
  return JSON.parse(localStorage.getItem("xyl_tokens") || "[]");
}

function removeSavedToken(address) {
  const addr = (address || "").toLowerCase();
  const tokens = getStoredTokens();
  const updated = tokens.filter(t => (t.address || "").toLowerCase() !== addr);
  localStorage.setItem("xyl_tokens", JSON.stringify(updated));
}

function saveToken(address, name, symbol) {
  const txs = JSON.parse(localStorage.getItem("xyl_tokens") || "[]");
  txs.unshift({ address: (address || "").toLowerCase(), name, symbol });
  localStorage.setItem("xyl_tokens", JSON.stringify(txs));
}
