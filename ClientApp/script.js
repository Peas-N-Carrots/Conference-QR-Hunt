/**
 * @file ClientApp/script.js
 * @author Joe Maloney
 * Handles behavior related to joining/playing a game as well as the model
 * to link it to the HTML document.
*/

/**
 * Helper function to compute a deterministic hash using djb2 algorithm
 * @param {string} str - The input string to hash
 * @returns {string} - The resulting hash as a string
 */
function computeGameId(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Ensure unsigned 32-bit integer
}

/**
 * Class to store/encapsulate the player state
 */
class clientGame {
    #qList = [];
    #qAnswers = new Map();
    #qFound = new Map();
    #pUsed = new Set();
    #gName = "";
    #gameId = "";
    #pName = "";
    #pId = "";

    constructor() {
        this.#unhashState();
        if (!this.#pId) {
            this.#pId = crypto.randomUUID();
            this.#hashState();
        }
    }

    getGameName() {
        return this.#gName;
    }

    getPlayerName() {
        return this.#pName;
    }

    getQuestions() {
        return [...this.#qList];
    }

    setAnswer(question) {
        if (!this.#qAnswers.has(question)) return false;
        this.#qAnswers.set(question, true);
        this.#hashState();
        return true;
    }

    unsetAnswer(question) {
        if (!this.#qAnswers.has(question)) return false;
        this.#qAnswers.set(question, false);
        const pId = this.#qFound.get(question);
        if (pId) {
            this.#pUsed.delete(pId);
        }
        this.#qFound.delete(question);
        this.#hashState();
        return true;
    }

    getAnswer(question) {
        return this.#qAnswers.get(question) || false;
    }

    getFound(question) {
        return this.#qFound.get(question) || null;
    }

    isComplete() {
        if (this.#qList.length === 0) return false;
        return this.#qList.every(question => this.#qFound.has(question));
    }

    #unhashState() {
        try {
            const hashString = window.location.hash.slice(1);
            const jsonString = LZString.decompressFromEncodedURIComponent(hashString);
            const obj = JSON.parse(jsonString);
            if (obj.host) {
                this.#gName = obj.title;
                this.#gameId = computeGameId(obj.title + JSON.stringify(obj.list));
                for (const item of obj.list) {
                    this.#qList.push(item);
                    this.#qAnswers.set(item, false);
                }
            } else {
                this.#gName = obj.gName;
                this.#gameId = obj.gameId;
                this.#qList = obj.qList;
                this.#pName = obj.pName;
                this.#pId = obj.pId;
                this.#qAnswers = new Map(obj.qAnswers);
                this.#qFound = new Map(obj.qFound);
                this.#pUsed = new Set(obj.pUsed);
            }
        } catch (e) {
            console.error("Error decoding state", e);
        }
    }

    #hashState() {
        const jsonString = JSON.stringify({
            host: false, // Ensures correct restoration for returning players
            gName: this.#gName,
            gameId: this.#gameId, // Ensures gameId survives reload
            qList: this.#qList,
            pName: this.#pName,
            pId: this.#pId, // Ensures pId is not regenerated
            qAnswers: Array.from(this.#qAnswers.entries()),
            qFound: Array.from(this.#qFound.entries()),
            pUsed: Array.from(this.#pUsed) // Serializes Maps/Sets correctly
        });
        const hashString = LZString.compressToEncodedURIComponent(jsonString);
        window.location.hash = hashString;
    }

    genQR(container) {
        const payload = {
            gameId: this.#gameId,
            pName: this.#pName,
            pId: this.#pId,
            yesQuestions: [...this.#qAnswers.entries()].filter(([_, v]) => v).map(([k]) => k)
        };
        const url = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        container.innerHTML = "";

        const size = Math.min(
            window.innerWidth * 0.7,
            window.innerHeight * 0.5,
            600
        );

        QRCode.toCanvas(url, { width: size }, (err, canvas) => {
            if (!err) container.appendChild(canvas);
        });
    }

    validateScan(payload, question) {
        if (payload.gameId !== this.#gameId) {
            return { success: false, error: "Wrong game" };
        }
        if (this.#pUsed.has(payload.pId)) {
            return { success: false, error: "Player already used" };
        }
        if (!payload.yesQuestions.includes(question)) {
            return { success: false, error: "Player did not answer yes to this question" };
        }
        this.#qFound.set(question, payload.pId);
        this.#pUsed.add(payload.pId);
        this.#hashState();
        return { success: true };
    }

    setPlayerName(name) {
        this.#pName = name;
        this.#hashState();
    }
}

const client = new clientGame();
const html5QrCode = new Html5Qrcode("reader");

const personalButton = document.getElementById("personal-button");
const listButton = document.getElementById("list-button");
const personalPage = document.getElementById("personal-page");
const listPage = document.getElementById("list-page");
const completionState = document.getElementById("completion-state");
const completionTimestamp = document.getElementById("completion-timestamp");

// Add module-level variables
let profilePage = true;
let activeQuestion = null;
let completionTime = null;

// Add event listener for Cancel button
document.getElementById("cancel-button").addEventListener("click", () => {
    activeQuestion = null;
    html5QrCode.stop();
    render();
});

// Update render() function
function render() {
    if (client.isComplete()) {
        personalPage.hidden = true;
        listPage.hidden = true;
        completionState.hidden = false;
        return;
    }

    personalPage.hidden = !profilePage;
    listPage.hidden = profilePage;
    completionState.hidden = true;

    if (completionTime) {
        completionTimestamp.textContent = `Completed at: ${completionTime}`;
    }

    // Render Profile tab
    const questionList = document.getElementById("question-list");
    questionList.innerHTML = "";
    client.getQuestions().forEach(question => {
        const li = document.createElement("li");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = client.getAnswer(question);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                client.setAnswer(question);
            } else {
                client.unsetAnswer(question);
            }
            render();
        });
        const label = document.createElement("label");
        label.textContent = question;
        li.appendChild(checkbox);
        li.appendChild(label);
        questionList.appendChild(li);
    });

    const userNameInput = document.getElementById("user-name-input");
    userNameInput.value = client.getPlayerName();

    if (profilePage) {
        client.genQR(document.getElementById("qr-container"));
    }

    // Render Hunt tab
    const checkList = document.getElementById("check-list");
    checkList.innerHTML = "";
    client.getQuestions().forEach(question => {
        const li = document.createElement("li");
        const status = document.createElement("span");
        const found = client.getFound(question);
        if (found) {
            const uncheckButton = document.createElement("button");
            uncheckButton.textContent = "✓ Uncheck";
            uncheckButton.addEventListener("click", () => {
                client.unsetAnswer(question);
                render();
            });
            li.appendChild(uncheckButton);
        } else {
            status.textContent = "○";
            li.appendChild(status);
            const scanButton = document.createElement("button");
            scanButton.textContent = "Scan";
            scanButton.addEventListener("click", () => {
                if (html5QrCode.isScanning) return;
                activeQuestion = question;
                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 20, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        const payload = JSON.parse(LZString.decompressFromEncodedURIComponent(decodedText));
                        const result = client.validateScan(payload, activeQuestion);
                        if (result.success) {
                            alert("Scan successful!");
                            if (client.isComplete() && !completionTime) {
                                completionTime = new Date().toLocaleString();
                            }
                        } else {
                            alert(`Scan failed: ${result.error}`);
                        }
                        activeQuestion = null;
                        html5QrCode.stop();
                        render();
                    },
                    (errorMessage) => {
                        console.warn(`QR Code scan error: ${errorMessage}`);
                    }
                );
            });
            li.appendChild(scanButton);
        }
        const text = document.createTextNode(` ${question} `);
        li.appendChild(text);
        checkList.appendChild(li);
    });

    // Show/hide Cancel button
    const readerDiv = document.getElementById("reader");
    const cancelButton = document.getElementById("cancel-button");
    if (activeQuestion) {
        readerDiv.hidden = false;
        cancelButton.hidden = false;
        // cancelButton.addEventListener("click", () => {
        //     activeQuestion = null;
        //     html5QrCode.stop();
        //     render();
        // });
    } else {
        readerDiv.hidden = true;
        cancelButton.hidden = true;
    }
}

document.getElementById("user-name-input").addEventListener("change", (e) => {
    client.setPlayerName(e.target.value);
});

personalButton.addEventListener("click", () => {
    profilePage = true;
    render();
});

listButton.addEventListener("click", () => {
    profilePage = false;
    render();
});

render();
