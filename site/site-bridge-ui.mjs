import {copyToSiteMyDecks} from './site-bridge.mjs';

function attachCopyButton() {
  const exportButton = document.querySelector('#exportDeck');
  if (!exportButton || document.querySelector('#copyToMain')) return;
  const button = document.createElement('button');
  button.id = 'copyToMain';
  button.type = 'button';
  button.textContent = 'サイトのマイデッキへコピー';
  const status = document.createElement('p');
  status.id = 'copyStatus';
  status.className = 'muted';
  status.setAttribute('role', 'status');
  exportButton.after(button);
  button.parentElement.after(status);
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'コピー中…';
    try {
      await copyToSiteMyDecks(window.atlantisCurrentDeck);
      status.textContent = 'サイトのマイデッキへコピーしました。';
      const link = document.createElement('a');
      link.href = 'index.html#my';
      link.textContent = 'マイデッキを開く';
      link.className = 'site-back';
      status.append(' ', link);
    } catch (error) {
      status.textContent = `コピーできませんでした：${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
}

new MutationObserver(attachCopyButton).observe(document.querySelector('#modalBody'), {childList:true, subtree:true});
attachCopyButton();
