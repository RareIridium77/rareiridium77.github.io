function cleanMessage(raw) {
    const firstLine = raw.split("\n").find(line => line.trim()) || "No message";
    if (/^[a-z+]+:/i.test(firstLine)) {
        return firstLine.replace(/^[^:]+:\s*/i, "");
    }
    return firstLine;
}

export { cleanMessage };
export default { cleanMessage };
