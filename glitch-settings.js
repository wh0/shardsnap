cm = document.querySelector('.CodeMirror').CodeMirror;
cm.setOption('indentWithTabs', true);
cm.setOption('tabSize', 4);
cm.setOption('indentUnit', 4);
delete cm.getOption('extraKeys')['Tab'];
