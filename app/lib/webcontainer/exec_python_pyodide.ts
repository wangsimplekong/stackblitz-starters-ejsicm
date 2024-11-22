import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";

let pyodide;

async function initializePyodide() {
  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.22.1/full/"
  });
}


async function runPythonCommand(command) {
  if (!pyodide) {
    await initializePyodide();
  }
  
  try {
    return await pyodide.runPythonAsync(command);
  } catch (error) {
    console.error('Python execution error:', error);
    throw error;
  }
}

async function executePythonFile(filePath) {
  if (!pyodide) {
    await initializePyodide();
  }

  try {
    // 读取文件内容
    const fileContent = await webcontainerInstance.fs.readFile(filePath, 'utf-8');
    // 使用 Pyodide 执行
    return await pyodide.runPythonAsync(fileContent);
  } catch (error) {
    console.error('Error executing Python file:', error);
    throw error;
  }
}