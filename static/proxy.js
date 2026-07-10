const toUse = `https://corsproxy.io/?url={link}`;

function proxy(url) {
    const formed = toUse.replace("{link}", encodeURIComponent(url));
    return formed;
}

export default proxy;