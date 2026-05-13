document.addEventListener('htmx:afterRequest', function(event) {
  if (event.detail && event.detail.xhr) {
    try {
      var data = JSON.parse(event.detail.xhr.responseText);
      var target = document.getElementById('promote-result');
      if (!target) return;
      if (data.success) {
        target.innerHTML = '<div class="alert alert-success"><span>User promoted successfully. <a href="/alice/users" class="link">Refresh</a> to see changes.</span></div>';
      } else if (data.error) {
        target.innerHTML = '<div class="alert alert-error"><span>' + data.error + '</span></div>';
      }
    } catch(e) {}
  }
});