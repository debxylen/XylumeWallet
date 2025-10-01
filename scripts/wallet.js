const RPC_URL = "https://xylume-testnet.sparked.network/rpc/";
const CHAIN_ID = 6934;
let privateKey = localStorage.getItem('walletPrivateKey');

// 🔐 Setup wallet
let wallet, provider, walletWithProvider;
if (privateKey) {
  wallet = new ethers.Wallet(privateKey);
  provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  walletWithProvider = wallet.connect(provider);
}

async function initializeApp() {
  // 👛 Fill in wallet address
  document.getElementById("receiveAddress").value = wallet.address;

  // 📷 Generate QR
  QRCode.toCanvas(document.getElementById("qrContainer"), `ethereum:${wallet.address}`, {
    width: 192,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });

  // 📟 Load balance + start loop
  await loadBalance();
  setInterval(loadBalance, 10000);

  // 🧂 UI listeners
  document.getElementById("copyAddress").addEventListener("click", () => {
    navigator.clipboard.writeText(wallet.address).then(() => {
      showToast("Copied!", "Address copied to clipboard");
    });
  });

  document.getElementById("sendBtn").addEventListener("click", () => {
    document.getElementById("sendModal").classList.remove("hidden");
  });

  document.getElementById("receiveBtn").addEventListener("click", () => {
    document.getElementById("receiveModal").classList.remove("hidden");
  });

  document.getElementById("addTokenBtn").addEventListener("click", () => {
    document.getElementById("addTokenModal").classList.remove("hidden");
  });

  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("sendModal").classList.add("hidden");
      document.getElementById("receiveModal").classList.add("hidden");
      document.getElementById("addTokenModal").classList.add("hidden");
      document.getElementById("tokenCtxModal").classList.add("hidden");
    });
  });

  document.getElementById("refreshBalanceBtn").onclick = async () => {
    const btn = document.getElementById("refreshBalanceBtn");
    btn.classList.add("fast-spin");

    const delay = new Promise(res => setTimeout(res, 500));

    await Promise.all([
      loadBalance(),
      updateAllTokenBalances(),
      delay
    ]);

    btn.classList.remove("fast-spin");
  };

  // 📇 Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active", "bg-primary", "text-black"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active", "bg-primary", "text-black");
      document.getElementById(tab).classList.add("active");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem('walletPrivateKey')) {
    initializeWalletSetup(); // this reloads the page
  } else {
    initializeApp();
  }
});

// 💰 Load & show balance
async function loadBalance() {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [wallet.address, "latest"]
    })
  });
  const { result } = await res.json();
  const xyl = parseFloat(ethers.utils.formatEther(result)).toFixed(4);
  document.querySelectorAll("#xylBalance").forEach(el => el.textContent = `${xyl} XYL`);
}
