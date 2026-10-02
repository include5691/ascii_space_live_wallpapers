UUID := space-wallpaper@include5691.github.io
BUNDLE := $(UUID).shell-extension.zip
MODULES := renderer.js frame.js options.js choices.js events.js shader.js sky.js galaxy.js debris.js cosmos.js birth.js
SOURCES := metadata.json extension.js prefs.js $(MODULES) README.md $(wildcard textures/*.png) $(wildcard schemas/*.xml)

.PHONY: pack install uninstall clean

pack: $(BUNDLE)

$(BUNDLE): $(SOURCES)
	gnome-extensions pack --force $(addprefix --extra-source=,$(MODULES) README.md textures)

install: $(BUNDLE)
	gnome-extensions install --force $(BUNDLE)

uninstall:
	rm -rf "$${XDG_DATA_HOME:-$$HOME/.local/share}/gnome-shell/extensions/$(UUID)"

clean:
	rm -f $(BUNDLE)
