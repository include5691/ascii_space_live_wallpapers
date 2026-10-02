import {PROPERTIES} from './settings.js';

const property = ({text, type, value, choices, min, max, condition}, order) => ({
    order,
    text,
    type,
    value,
    ...(choices && {options: choices.map(([choice, label]) => ({label, value: choice}))}),
    ...(type === 'slider' && {min, max, step: 1, precision: 0, editable: true}),
    ...(condition && {condition}),
});

const project = {
    title: 'Space Wallpaper',
    description: 'A live ASCII-art space wallpaper with black holes, neutron stars, stars, wormholes, galaxies and the solar system, rendered on the GPU. It turns to follow your cursor.',
    type: 'web',
    file: 'index.html',
    preview: 'preview.jpg',
    tags: ['Sci-Fi'],
    contentrating: 'Everyone',
    general: {
        supportsaudioprocessing: false,
        properties: Object.fromEntries(Object.entries(PROPERTIES).map(([key, entry], index) => [key, property(entry, 100 + index)])),
    },
};

console.log(JSON.stringify(project, null, 4));
