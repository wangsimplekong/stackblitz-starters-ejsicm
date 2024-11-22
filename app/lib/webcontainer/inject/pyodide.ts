import { WebContainer } from '@webcontainer/api';

const PYTHON_ROOT = '.hidden-pyodide';
//'/home/project/.hidden-pyodide';

const install_python_files = {
  [`.hidden_pyodide_package.json`]: {
    file: {
      contents: `{
        "name": "webcontainer-pyodide",
        "type": "module",
        "dependencies": {
          "pyodide": "^0.24.1"
        }
      }`
    }
  },
  [`.hidden_pyodide_python`]: {
    file: {
      contents: `#!/usr/bin/env node
import { loadPyodide } from 'pyodide';
import path from 'path';

const PYODIDE_ROOT = '${PYTHON_ROOT}';

async function main() {
  const args = process.argv.slice(2);
  
  try {
    const pyodide = await loadPyodide({
      indexURL: path.join(PYODIDE_ROOT, 'node_modules/pyodide'),
      stdout: (text) => console.log(text),
      stderr: (text) => console.error(text)
    });

    if (args.length === 0) {
      console.log("Python 3.11.3 (Pyodide)");
      return;
    }

    if (args[0] === '-c') {
      await pyodide.runPythonAsync(args[1]);
    } else {
      const code = await readFile(args[0]);
      await pyodide.runPythonAsync(code);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();`,
      permissions: '755'
    }
  }
};

function injectPyodide(webcontainer: WebContainer) {
  return webcontainer.spawn('mkdir', ['-p', `${PYTHON_ROOT}`])
    .then(() => webcontainer.mount(install_python_files))
    .then(() => webcontainer.spawn('mv', ['.hidden_pyodide_package.json', `${PYTHON_ROOT}/package.json`]))
    .then(() => webcontainer.spawn('mv', ['.hidden_pyodide_python', `${PYTHON_ROOT}/python`]))
    .then(() => webcontainer.spawn('npm', ['install'], {cwd: PYTHON_ROOT}))
    .then(() => webcontainer.spawn('chmod', ['+x', `${PYTHON_ROOT}/python`]))
    //.then(() => webcontainer.spawn('ln', ['-s', `${PYTHON_ROOT}/python`, '/usr/local/bin/pythond']));
    
}

export default injectPyodide;
