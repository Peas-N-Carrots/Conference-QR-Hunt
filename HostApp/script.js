/**
 * @file HostApp/script.js
 * @author Joe Maloney
 * Handles behavior related to setting up/hosting a game
*/

/**
 * Class to store the game state
 */
class hostGame {
    /** Variable to keep track of the question list */
    #qList = [];

    /** Variable to keep track of the game name */
    #gName = "";

    constructor() {
        this.#unhashState();
    }

    getGameName() {
        return this.#gName;
    }

    getQuestions() {
        return [...this.#qList];
    }

    /**
     * Adds an item to the question list
     * @param {string} item 
     * @return {object} an object with a boolean for success and optional error string
     */
    qListAdd(item) {
        // error check
        if (typeof item !== 'string') {
            return { success: false, error: "Item must be a string" };
        }
        
        if (!item.trim()) {
            return { success: false, error: "Question cannot be empty" };
        }
        
        const wordCount = item.trim().split(/\s+/).length;
        if (wordCount > 20) {
            return { success: false, error: `Question must be 20 words or less (currently ${wordCount} words)` };
        }

        // add item
        this.#qList.push(item);
        this.#hashState();
        return { success: true };
    }

    /**
     * Deletes an index from the list
     * @param {number} index 
     */
    qListDelete(index) {
        this.#qList.splice(index, 1);
        this.#hashState();
    }

    /**
     * Sets the game name
     * @param {string} name
     */
    setGName(name) {
        this.#gName = name;
        this.#hashState();
    }

    /**
     * Helper method to generate a JSON string and encode it
     */
    #hashState() {
        const jsonString = JSON.stringify({
            title: this.#gName,
            list: this.#qList
        });
        const hashString = LZString.compressToEncodedURIComponent(jsonString);
        window.location.hash = hashString;
    }

    /**
     * Helper method to decode the hash string and unpack its state
     */
    #unhashState() {
        const hashString = window.location.hash.slice(1);
        const jsonString = LZString.decompressFromEncodedURIComponent(hashString);
        const obj = JSON.parse(jsonString);
        if (!obj) {
            this.#gName = "";
            this.#qList = [];
            return { success: false, error: "Error decoding" };
        } else {
            this.#gName = obj.title;
            this.#qList = obj.list;
            return { success: true };
        }
    }

    /**
     * method to generate the QR code
     */
    genQR(container) {
        // TODO
        
        // const url = window.location.hash;
        // container.innerHTML = "";
        // QRCode.toCanvas(url, { width: 200 }, (err, canvas) => {
        //     if (!err) container.appendChild(canvas);
        // });
    }
}

/** instance of the host game */
const host = new hostGame();

/** references to important elements of the document */
const nameInput = document.getElementById("game-name-input");
const questionInput = document.getElementById("question-input");
const addBtn = document.getElementById("add-question-btn");
const listEl = document.getElementById("question-list");
const qrPlaceholder = document.getElementById("qr-placeholder");
const qrContainer = document.getElementById("qr-container");

/**
 * Adds items in qList to the screen.
 */
function render() {
    nameInput.value = host.getGameName();

    listEl.innerHTML = "";

    const questions = host.getQuestions();

    questions.forEach((text, index) => {
        const li = document.createElement("li");

        const span = document.createElement("span");
        span.textContent = text;

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "delete-btn";

        delBtn.addEventListener("click", () => {
            host.qListDelete(index);
            render();
        });

        li.appendChild(span);
        li.appendChild(delBtn);
        listEl.appendChild(li);
    });

    if (questions.length === 0) {
        qrPlaceholder.hidden = false;
        qrContainer.hidden = true;
    } else {
        qrPlaceholder.hidden = true;
        qrContainer.hidden = false;
        host.genQR(qrContainer);
    }
}

/**
 * Connect the add button with the functionality to add an item to the list
 * and re-render the question list
 */
addBtn.addEventListener("click", () => {
    const result = host.qListAdd(questionInput.value);
    if (result.success) {
        questionInput.value = "";
        render();
    }
});

/**
 * Pressing enter re-routes to clicking add (see above)
 */
questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        addBtn.click();
    }
});

nameInput.addEventListener("change", () => {
    host.setGName(nameInput.value);
})

render();
