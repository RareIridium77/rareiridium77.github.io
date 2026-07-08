// Yo wfuck is ts

class PasswordGeneratorContext {
    length = 20;

    uppercase = true;
    lowercase = true;
    numbers = true;
    symbols = true;

    excludeSimilar = true;
    excludeAmbiguous = true;

    constructor({
        length = 20,
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = true,
        excludeSimilar = true,
        excludeAmbiguous = true
    } = {}) {
        Object.assign(this, {
            length,
            uppercase,
            lowercase,
            numbers,
            symbols,
            excludeSimilar,
            excludeAmbiguous
        });
    }
}

const CHARSETS = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{}<>?/|\\~`.,:;"
};

const SIMILAR = "0Oo1lI";
const AMBIGUOUS = "{}[]()/\\\\'\"`,;:.<>";

function generate(context = new PasswordGeneratorContext(), charsets = CHARSETS, similar = SIMILAR, ambiguous = AMBIGUOUS) {
    let chars = "";

    if (context.uppercase) chars += charsets.uppercase;
    if (context.lowercase) chars += charsets.lowercase;
    if (context.numbers) chars += charsets.numbers;
    if (context.symbols) chars += charsets.symbols;

    if (context.excludeSimilar) {
        chars = [...chars].filter(c => !similar.includes(c)).join("");
    }

    if (context.excludeAmbiguous) {
        chars = [...chars].filter(c => !ambiguous.includes(c)).join("");
    }

    if (!chars.length)
        throw new Error("No characters available.");

    const bytes = new Uint32Array(context.length);
    crypto.getRandomValues(bytes);

    let password = "";

    for (const value of bytes) {
        password += chars[value % chars.length];
    }

    return password;
}

const PasswordGenerator = {
    PasswordGeneratorContext,
    generate
}

export default PasswordGenerator;