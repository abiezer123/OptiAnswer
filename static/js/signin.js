document.addEventListener("DOMContentLoaded", function () {
    const emailInput = document.querySelector("input[type='email']");
    
    emailInput.addEventListener("focus", function () {
        this.style.border = "1px solid #417d74";
    });

    emailInput.addEventListener("blur", function () {
        this.style.border = "1px solid #ccc";
    });
});
