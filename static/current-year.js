function getCurrentYear() {
    const now = new Date();
    
    return `${now.getFullYear()}`;
}

const yearEl = document.getElementById("current-year");
yearEl.textContent = getCurrentYear();