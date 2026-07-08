import PasswordGenerator from "./password-generator.js";

const PasswordGeneratorContext = PasswordGenerator.PasswordGeneratorContext;

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        password: document.getElementById("generated-password-input"),

        length: document.getElementById("password-length-input"),
        lengthLabel: document.getElementById("password-length-label"),

        uppercase: document.getElementById("password-uppercase-input"),
        lowercase: document.getElementById("password-lowercase-input"),
        numbers: document.getElementById("password-numbers-input"),
        symbols: document.getElementById("password-symbols-input"),

        excludeSimilar: document.getElementById("password-exclude-similar-input"),
        excludeAmbiguous: document.getElementById("password-exclude-ambiguous-input"),

        strength: document.getElementById("password-strength"),

        generate: document.getElementById("password-generate"),
        copy: document.getElementById("password-copy")
    };

    function createContext() {
        return new PasswordGeneratorContext({
            length: Number(elements.length.value),

            uppercase: elements.uppercase.checked,
            lowercase: elements.lowercase.checked,
            numbers: elements.numbers.checked,
            symbols: elements.symbols.checked,

            excludeSimilar: elements.excludeSimilar.checked,
            excludeAmbiguous: elements.excludeAmbiguous.checked
        });
    }

    function updateLengthLabel() {
        elements.lengthLabel.textContent =
            `Password Length: ${elements.length.value}`;
    }

    function updatePassword() {
        updateLengthLabel();

        const context = createContext();

        console.log(context);

        try {
            const password = PasswordGenerator.generate(context);
            elements.password.value = password;

            updateStrength(password);
        }
        catch (e) {
            console.error(e);
            elements.password.value = "";
            elements.strength.innerHTML =
                `Password Strength <span class="strength-level" data-level="0">Invalid</span>`;
        }
    }

    function updateStrength(password) {
        let score = 0;

        // Length
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (password.length >= 24) score++;

        // Different types
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        // Unique
        const unique = new Set(password).size;
        score += unique / password.length;

        // Repeats
        const repeated = /(.)\1{2,}/.test(password);
        if (repeated)
            score -= 2;

        // Limitations
        score = Math.max(0, Math.min(score, 10));

        let level;
        let text;

        if (score >= 8) {
            level = 4;
            text = "Very Strong";
        }
        else if (score >= 6) {
            level = 3;
            text = "Strong";
        }
        else if (score >= 4) {
            level = 2;
            text = "Medium";
        }
        else if (score >= 2) {
            level = 1;
            text = "Weak";
        }
        else {
            level = 0;
            text = "Very Weak";
        }

        elements.strength.innerHTML =
            `Password Strength <span class="strength-level" data-level="${level}">${text}</span>`;
    }

    // any changes
    [
        elements.length,
        elements.uppercase,
        elements.lowercase,
        elements.numbers,
        elements.symbols,
        elements.excludeSimilar,
        elements.excludeAmbiguous
    ].forEach(element => {
        element.addEventListener("input", updatePassword);
        element.addEventListener("change", updatePassword);
    });

    // Generate
    elements.generate.addEventListener("click", updatePassword);

    // Copy
    elements.copy.addEventListener("click", async () => {
        if (!elements.password.value)
            return;

        await navigator.clipboard.writeText(elements.password.value);

        const old = elements.copy.textContent;
        elements.copy.textContent = "Copied!";

        setTimeout(() => {
            elements.copy.textContent = old;
        }, 1000);
    });

    // Initial password
    updatePassword();
});