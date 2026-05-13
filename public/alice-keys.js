document.addEventListener('htmx:afterRequest', function(event) {
  if (event.detail && event.detail.xhr) {
    try {
      var data = JSON.parse(event.detail.xhr.responseText);
      var target = document.getElementById('key-result');
      if (!target) return;
      if (data.plaintext) {
        target.innerHTML = '<div class="alert alert-warning"><span>Key created! Copy it now — it will not be shown again:</span><code class="font-mono break-all">' + data.plaintext + '</code></div>';
      } else if (data.success) {
        target.innerHTML = '<div class="alert alert-success"><span>Action completed. <a href="/alice/api-keys" class="link">Refresh</a> to see changes.</span></div>';
      } else if (data.error) {
        target.innerHTML = '<div class="alert alert-error"><span>' + data.error + '</span></div>';
      }
    } catch(e) {}
  }
});