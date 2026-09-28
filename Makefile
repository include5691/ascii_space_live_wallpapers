UUID := space-wallpaper@include5691.github.io
BUNDLE := $(UUID).shell-extension.zip
SOURCES := metadata.json extension.js prefs.js renderer.js events.js shader.js earthmap.js sky.js galaxy.js $(wildcard schemas/*.xml)

.PHONY: pack install uninstall clean

pack: $(BUNDLE)

$(BUNDLE): $(SOURCES)
	gnome-extensions pack --force --extra-source=renderer.js --extra-source=events.js --extra-source=shader.js --extra-source=earthmap.js --extra-source=sky.js --extra-source=galaxy.js

install: $(BUNDLE)
	gnome-extensions install --force $(BUNDLE)

uninstall:
	rm -rf "$${XDG_DATA_HOME:-$$HOME/.local/share}/gnome-shell/extensions/$(UUID)"

clean:
	rm -f $(BUNDLE)
