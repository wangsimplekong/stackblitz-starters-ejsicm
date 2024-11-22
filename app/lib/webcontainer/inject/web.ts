import { WebContainer } from '@webcontainer/api';

const WEB_ROOT = '.hidden-web';

const install_web_files = {
  [`${WEB_ROOT}/package.json`]: {
    file: {
      contents: `{
        "name": "webcontainer-static-server",
        "type": "module",
        "dependencies": {
          "express": "^4.18.2"
        }
      }`
    }
  },
  [`${WEB_ROOT}/server.js`]: {
    file: {
      contents: `import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(\`Static server running on port \${PORT}\`);
});`
    }
  }
};

function injectWeb(webcontainer: WebContainer) {
  return webcontainer.spawn('mkdir', ['-p', `${WEB_ROOT}/public`]).then(() => {
    return webcontainer.mount(install_web_files).then(() => {
      return webcontainer.spawn('npm', ['install'], {cwd: WEB_ROOT});
    });
  });
}

export default injectWeb; 