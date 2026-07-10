import proxy from '/static/proxy.js';
import { cleanMessage } from '/static/utils.js';

const DEFAULT_CONFIG = {
    cacheTTL: 600000,
    commitLimit: 10,
    keywords: {},
    render: {
        loading: "Loading commits...",
        errorCommits: "Failed to load commits",
        errorRepositories: "Failed to load repositories",
        emptyRepositories: "No repositories found",
        emptyCommits: "No commits found",
        commitDateFormat: "default",
        showAuthor: true,
        showDate: true,
        showSha: true
    }
};

const DEFAULT_RENDERERS = {
    layout({ root }) {
        const select = document.createElement("select");
        const list = document.createElement("ul");

        root.replaceChildren(select, list);

        return { repoSelect: select, commitList: list };
    },

    status({ message, type }) {
        const item = document.createElement("li");
        item.textContent = message;
        item.dataset.status = type;

        if (type === "error") {
            item.style.color = "#f88";
        }

        return item;
    },

    repositoryOption({ repo }) {
        const option = document.createElement("option");
        option.value = repo.name;
        option.textContent = repo.name;

        return option;
    },

    commit({ repo, user, tags, message, sha, fullSha, author, date, config }) {
        const item = document.createElement("li");
        item.style.marginBottom = "14px";

        tags.forEach((tag, index) => {
            const label = document.createElement("span");
            label.className = "commit-tag";
            label.style.color = tag.color;
            label.textContent = tag.label;
            item.appendChild(label);
            item.append(index === tags.length - 1 ? " - " : ", ");
        });

        item.append(message);
        item.appendChild(document.createElement("br"));

        const details = [];
        if (config.showAuthor && author) details.push(author);
        if (config.showDate && date) details.push(date);

        const meta = document.createElement("small");
        meta.style.color = "#aaa";
        meta.append(details.join(" * "));

        if (config.showSha && sha) {
            if (details.length > 0) meta.append(" * ");

            const link = document.createElement("a");
            link.href = `https://github.com/${user}/${repo}/commit/${fullSha}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.style.color = "#888";

            const code = document.createElement("code");
            code.textContent = sha;
            link.appendChild(code);
            meta.appendChild(link);
        }

        item.appendChild(meta);

        return item;
    }
};

class Cache {
    constructor(ttl) {
        this.ttl = ttl;
    }

    get(key) {
        const cached = localStorage.getItem(key);
        if (!cached) return { data: null, expired: false };

        try {
            const parsed = JSON.parse(cached);
            const expired = Date.now() - parsed.time > this.ttl;
            return { data: parsed.data, expired };
        } catch {
            return { data: null, expired: false };
        }
    }

    set(key, data) {
        localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
    }
}

export default class GithubWidget {
    constructor(options = {}) {
        this.options = options;
        this.inlineConfig = typeof options.config === "object" ? options.config : null;
        this.configPath = typeof options.config === "string"
            ? options.config
            : options.configPath ?? "/configurations/github.json";
        this.root = typeof options.target === "string"
            ? document.querySelector(options.target)
            : options.target;
        this.renderers = { ...DEFAULT_RENDERERS, ...(options.renderers ?? {}) };

        if (!this.root)
            throw new Error(`Target '${options.target}' not found.`);
    }

    async init() {
        this.config = await this.loadConfig();

        this.user = this.config.user;
        this.commitLimit = this.config.commitLimit;
        this.keywords = this.config.keywords;
        this.cache = new Cache(this.config.cacheTTL);
        this.renderConfig = this.config.render;

        this.render();

        await this.loadRepositories();
    }

    async loadConfig() {
        if (this.inlineConfig) {
            return this.mergeConfig(this.inlineConfig);
        }

        const response = await fetch(this.configPath);

        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }

        const config = await response.json();

        return this.mergeConfig(config);
    }

    mergeConfig(config) {
        return {
            ...DEFAULT_CONFIG,
            ...config,
            render: {
                ...DEFAULT_CONFIG.render,
                ...(config.render ?? {}),
                ...(this.options.render ?? {})
            },
            keywords: {
                ...DEFAULT_CONFIG.keywords,
                ...(config.keywords ?? {})
            }
        };
    }

    render() {
        const parts = this.renderers.layout({
            root: this.root,
            widget: this,
            config: this.renderConfig
        });

        this.repoSelect = parts.repoSelect;
        this.commitList = parts.commitList;

        this.repoSelect.addEventListener("change", () => {
            this.loadCommits(this.repoSelect.value);
        });
    }

    async api(url) {
        const response = await fetch(proxy(url));

        if (!response.ok)
            throw new Error(response.status);

        return response.json();
    }

    async fetchCached(key, url, force = false) {
        if (!force) {
            const cache = this.cache.get(key);

            if (cache.data && !cache.expired)
                return cache.data;
        }

        const data = await this.api(url);

        this.cache.set(key, data);

        return data;
    }

    async loadCommits(repo) {
        this.renderStatus(this.renderConfig.loading, "loading");

        try {
            const commits = await this.fetchCached(
                `commits:${this.user}:${repo}`,
                `https://api.github.com/repos/${this.user}/${repo}/commits`
            );

            this.renderCommits(commits, repo);
        } catch {
            this.renderStatus(this.renderConfig.errorCommits, "error");
        }
    }

    async loadRepositories() {
        this.renderStatus(this.renderConfig.loading, "loading");

        try {
            const repos = await this.fetchCached(
                `repos:${this.user}`,
                `https://api.github.com/users/${this.user}/repos`
            );

            this.populateRepos(repos);
        } catch {
            const option = document.createElement("option");

            option.disabled = true;
            option.textContent = this.renderConfig.errorRepositories;
            
            this.repoSelect.replaceChildren(option);
            this.renderStatus(this.renderConfig.errorRepositories, "error");
        }
    }

    renderStatus(message, type) {
        const status = this.renderers.status({
            message,
            type,
            widget: this,
            config: this.renderConfig
        });

        this.commitList.replaceChildren(status);
    }

    getKeywordInfo(msg) {
        const lowered = msg.toLowerCase();
        const firstLine = lowered.split("\n")[0];

        const words = firstLine
            .replace(/[^a-z\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);

        const found = [];

        for (const word of words) {
            if (this.keywords[word]) {
                found.push({
                    label: this.keywords[word].label,
                    color: this.keywords[word].color
                });
            }
        }

        const unique = new Map();
        for (const i of found) {
            unique.set(i.label, i);
        }

        return unique.size === 0
            ? [{ label: "Commit", color: "#999" }]
            : Array.from(unique.values());
    }

    renderCommits(commits, repo) {
        if (!commits.length) {
            this.renderStatus(this.renderConfig.emptyCommits, "empty");
            return;
        }

        const fragment = document.createDocumentFragment();

        commits.slice(0, this.commitLimit).forEach(commit => {
            const msg = commit.commit.message;
            const sha = commit.sha.substring(0, 7);
            const fullSha = commit.sha;
            const author = commit.commit.author.name;
            const date = this.formatDate(commit.commit.author.date);
            const info = this.getKeywordInfo(msg);
            const cleanedMsg = cleanMessage(msg);

            const item = this.renderers.commit({
                commit,
                repo,
                user: this.user,
                tags: info,
                message: cleanedMsg,
                sha,
                fullSha,
                author,
                date,
                widget: this,
                config: this.renderConfig
            });

            fragment.appendChild(item);
        });

        this.commitList.replaceChildren(fragment);
    }

    formatDate(date) {
        const parsed = new Date(date);
        const format = this.renderConfig.commitDateFormat;

        if (format === "iso") {
            return parsed.toISOString().split("T")[0];
        }

        if (format && format !== "default") {
            return new Intl.DateTimeFormat(format).format(parsed);
        }

        return parsed.toLocaleDateString();
    }

    populateRepos(repos) {
        if (!repos.length) {
            const option = document.createElement("option");
            option.disabled = true;
            option.textContent = this.renderConfig.emptyRepositories;
            this.repoSelect.replaceChildren(option);
            this.renderStatus(this.renderConfig.emptyRepositories, "empty");
            return;
        }

        const fragment = document.createDocumentFragment();

        repos.forEach(repo => {
            const option = this.renderers.repositoryOption({
                repo,
                widget: this,
                config: this.renderConfig
            });
            fragment.appendChild(option);
        });

        this.repoSelect.replaceChildren(fragment);

        const defaultRepo = this.config.defaultRepository;
        if ([...this.repoSelect.options].some(o => o.value === defaultRepo)) {
            this.repoSelect.value = defaultRepo;
            this.loadCommits(defaultRepo);
            return;
        }

        this.repoSelect.selectedIndex = 0;
        this.loadCommits(this.repoSelect.value);
    }

    destroy() {
        this.root.replaceChildren();
    }
}
