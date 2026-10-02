UUID := space-wallpaper@include5691.github.io
BUNDLE := $(UUID).shell-extension.zip
MODULES := renderer.js frame.js options.js choices.js events.js shader.js sky.js galaxy.js debris.js cosmos.js birth.js
SOURCES := metadata.json extension.js prefs.js $(MODULES) README.md $(wildcard textures/*.png) $(wildcard schemas/*.xml)
WALLPAPER_ENGINE := build/wallpaper-engine
ESBUILD := npx --yes esbuild@0.28.2

.PHONY: pack install uninstall clean wallpaper-engine

pack: $(BUNDLE)

$(BUNDLE): $(SOURCES)
	gnome-extensions pack --force $(addprefix --extra-source=,$(MODULES) README.md textures)

install: $(BUNDLE)
	gnome-extensions install --force $(BUNDLE)

uninstall:
	rm -rf "$${XDG_DATA_HOME:-$$HOME/.local/share}/gnome-shell/extensions/$(UUID)"

wallpaper-engine:
	rm -rf $(WALLPAPER_ENGINE)
	mkdir -p $(WALLPAPER_ENGINE)
	$(ESBUILD) wallpaper-engine/main.js --bundle --format=iife --loader:.png=dataurl --log-level=warning --outfile=$(WALLPAPER_ENGINE)/space.js
	node wallpaper-engine/project.js > $(WALLPAPER_ENGINE)/project.json
	cp wallpaper-engine/index.html wallpaper-engine/preview.jpg $(WALLPAPER_ENGINE)/

clean:
	rm -rf $(BUNDLE) build
