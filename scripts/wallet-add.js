function initializeWalletSetup() {
    // Show the modal
    const addWalletModal = document.getElementById('addWalletModal');
    addWalletModal.classList.remove('hidden');

    const tabs = document.querySelectorAll('.tab-btn-am');
    const tabContents = document.querySelectorAll('.tab-content-am');
    const mnemonicPhraseEl = document.getElementById('mnemonicPhrase');
    const generateNewPhraseBtn = document.getElementById('generateNewPhrase');
    const createWalletBtn = document.getElementById('createWalletBtn');
    const copyMnemonicBtn = document.getElementById('copyMnemonic');
    const importWalletBtn = document.getElementById('importWalletBtn');
    const importInput = document.getElementById('importInput');
    
    // Function to handle successful wallet setup
    function onWalletReady(wallet) {
        showLoader();
        localStorage.setItem('walletPrivateKey', wallet.privateKey);
        window.location.href = window.location.pathname + "?v=" + Date.now(); // Reload (no cache)
    }
    
    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === target) {
                    content.classList.add('active');
                }
            });
        });
    });

    // --- Create Wallet Logic ---
    function generateMnemonic() {
        const wallet = ethers.Wallet.createRandom();
        mnemonicPhraseEl.textContent = wallet.mnemonic.phrase;
    }
    generateNewPhraseBtn.addEventListener('click', generateMnemonic);
    copyMnemonicBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(mnemonicPhraseEl.textContent);
        showToast('Copied!', 'Mnemonic phrase copied.'); // Assumes you have a showToast function
    });
    createWalletBtn.addEventListener('click', () => {
        const mnemonic = mnemonicPhraseEl.textContent;
        const wallet = ethers.Wallet.fromMnemonic(mnemonic);
        onWalletReady(wallet);
    });

    // --- Import Wallet Logic ---
    importWalletBtn.addEventListener('click', () => {
        const input = importInput.value.trim();
        let wallet;
        try {
            if (input.startsWith('0x') && input.length === 66) {
                wallet = new ethers.Wallet(input);
            } else if (input.length === 64) { // not 0x-prefixed
                wallet = new ethers.Wallet(input);
            } else if (input.split(' ').length === 12 && ethers.utils.isValidMnemonic(input)) {
                wallet = ethers.Wallet.fromMnemonic(input);
            } else {
                showToast('Error', 'Invalid private key or phrase.');
                return;
            }
            onWalletReady(wallet);
        } catch (error) {
            console.error('Import error:', error);
            showToast('Error', 'Could not import wallet.');
        }
    });

    // Initial mnemonic generation
    generateMnemonic();
}
