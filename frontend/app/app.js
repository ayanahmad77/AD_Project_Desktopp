import { app, BrowserWindow, ipcMain, dialog, Notification } from "electron";
import path from "path";
import fs from "fs";

let electronWindow = null;
let startTimestamp = null;
let cameraShotPath = null;
let screenshotPath = null;

function createWindow() {
    electronWindow = new BrowserWindow({
        height: 1000,
        width: 1000,
        fullscreen: true,
        kiosk: true,
        webPreferences: {
            devTools: true,
            preload: path.join(import.meta.dirname, 'preload.js')
        }
    })

    electronWindow.loadURL('http://localhost:5173')
}

ipcMain.handle('start-timer', (event) => {
    startTimestamp = Date.now();

    // Send Timer Tick every 1s
    setInterval(() => {
        if (electronWindow && !electronWindow.isDestroyed()) {
            electronWindow.webContents.send('timer', (Date.now() - startTimestamp) / 1000);
        }
    }, 1000);

    // Capture user's camera snap every 5s
    setInterval(() => {
        if (electronWindow && !electronWindow.isDestroyed()) {
            electronWindow.webContents.send('camera-shot');
        }
    }, 5000);

    // Auto-capture screenshot of the exam window every 10s
    setInterval(async () => {
        if (electronWindow && !electronWindow.isDestroyed()) {
            try {
                const image = await electronWindow.webContents.capturePage();
                const buffer = image.toPNG();
                const dir = screenshotPath || path.join(import.meta.dirname, "screenshots");
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const fileName = `screenshot-auto-${Date.now()}.png`;
                fs.writeFileSync(path.join(dir, fileName), buffer);
            } catch (err) {
                console.error("Auto screenshot failed:", err);
            }
        }
    }, 10000);
})

// Handler for manual screenshot requests from renderer or shortcuts
ipcMain.handle('take-screenshot', async () => {
    try {
        if (!electronWindow || electronWindow.isDestroyed()) {
            return { success: false, error: "No active Electron window" };
        }
        const image = await electronWindow.webContents.capturePage();
        const buffer = image.toPNG();
        const dir = screenshotPath || path.join(import.meta.dirname, "screenshots");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const fileName = `screenshot-${Date.now()}.png`;
        const fullFilePath = path.join(dir, fileName);
        fs.writeFileSync(fullFilePath, buffer);
        console.log(`Screenshot saved to: ${fullFilePath}`);
        return { success: true, filePath: fullFilePath, fileName };
    } catch (error) {
        console.error("Take screenshot failed:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('store-screenshot-on-disk', (_event, data) => {
    try {
        const dir = screenshotPath || path.join(import.meta.dirname, "screenshots");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `screenshot-${Date.now()}.png`);
        fs.writeFileSync(filePath, Buffer.from(data));
        return { success: true, filePath };
    } catch (err) {
        console.error("Failed to store screenshot on disk:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('store-camera-snap-image-on-disk', (_event, data) => {
    try {
        const dir = cameraShotPath || path.join(import.meta.dirname, "user-camera-snap");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `${Date.now()}.jpg`);
        fs.writeFileSync(filePath, Buffer.from(data));
    } catch (err) {
        console.error("Failed to store camera snap:", err);
    }
})


ipcMain.on("show-rules", () => {
    dialog.showMessageBox(electronWindow, {
        type: "info",
        title: "Athena Exam Rules",
        message: "Exam Rules",
        detail:
            "1. Stay on the exam screen.\n" +
            "2. Camera must remain enabled.\n" +
            "3. Do not leave the exam.\n" +
            "4. Do not use external assistance.\n" +
            "5. Click Exit Exam when finished."
    });
});


app.whenReady().then(() => {
    createWindow();
});


async function showMessageBox() {
    const data = await dialog.showMessageBox({
        type: 'info',
        title: 'GuideLines for the exam',
        message: 'We store your data \n We take your capture shots after every 5 seconds \n If you caught cheating your marks will be zero',
        buttons: ['What Next', 'Go previous'],
        checkboxChecked: true,
        checkboxLabel: "Your are Ok with above guidelines"
    })

    const { response, checkboxChecked } = data;
    console.log(data);
    // response -> contains the index of the button
    // checkboxChecked -> contains user clicks the button
}


ipcMain.handle("showMessageBox", async () => {
    await showMessageBox();
})

// showOpenDialog box api can do lot of things can select files and folders
async function selectFile() {
    const response = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{
            name: 'ALl files',
            extensions: ['*']
        }],
    })

    // check what does response have
    const { filePaths, canceled } = response;
    console.log(response);
}

async function selectFolder() {
    const response = await dialog.showOpenDialog({
        title: 'Select the folder',
        buttonLabel: 'OK',
        properties: ['openDirectory'],
        defaultPath: '/'
    });

    const { filePaths, canceled } = response;
    if (!canceled && filePaths && filePaths.length > 0) {
        cameraShotPath = filePaths[0];
        screenshotPath = filePaths[0];
        console.log("Selected storage directory:", filePaths[0]);
        return filePaths[0];
    }
    return null;
}

ipcMain.handle("selectFile", async () => {
    await selectFile();
})


ipcMain.handle("selectFolder", async () => {
    await selectFolder();
})


async function showSaveDialogBox() {
    const response = await dialog.showSaveDialog({
        title: 'Where to save file',
        message: 'Select the folder to save the file',
        buttonLabel: 'Save as',
        defaultPath: '/'
    })

    console.log(response);
}


ipcMain.handle("showSaveDialogBox", async () => {
    await showSaveDialogBox();
})





// TASKS
// Task 1
// Add a Button to trigger a folder selection using the Dialog Box element.
// All the Camera Snaps captured should be stored in this folder.

// Task 2
// Add Buttons and a Checkbox to the existing Rules Dialog Box.
// console.log the Checkbox selection and Clicked Button.
