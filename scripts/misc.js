const gasSlider = document.getElementById("gas-price-slider");
const currentGasDisplay = document.getElementById("current-gas");
gasSlider.addEventListener("input", () => {
  if (!gasSlider.disabled) {
    currentGasDisplay.textContent = gasSlider.value + " wxei";
    const percentage = ((gasSlider.value - gasSlider.min) / (gasSlider.max - gasSlider.min)) * 100;
    gasSlider.style.backgroundSize = `${percentage}% 100%`;
  }
});

document.querySelectorAll("input:not([type=hidden]), textarea, select").forEach(input => {
  const randomName = "field_" + Math.random().toString(36).slice(2);
  input.setAttribute("name", randomName);
  input.setAttribute("autocomplete", "off");
});

function showToast(title, message, duration = 3000) {
  const toast = document.getElementById("toast");
  document.getElementById("toasth4").innerHTML = title;
  document.getElementById("toastp").innerHTML = message;
  toast.classList.remove("hidden");
  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

function hideToast() {
  document.getElementById("toast").classList.add("hidden");
}

document.getElementById("toast-close").addEventListener("click", hideToast);

function showLoader() {
  document.getElementById("loaderOverlay").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loaderOverlay").classList.add("hidden");
}
