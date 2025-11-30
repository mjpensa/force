const fs = require('fs');
const path = require('path');

const analysisPath = path.join(__dirname, 'pptx_analysis.json');
const outputPath = path.join(__dirname, '../Public/config/templates.js');

const rawContent = fs.readFileSync(analysisPath, 'utf8');
// PowerShell redirection might introduce null bytes or encoding issues.
// Let's try to clean it up.
const cleanedContent = rawContent.replace(/\0/g, '');
const jsonStartIndex = cleanedContent.indexOf('{');
const jsonString = cleanedContent.substring(jsonStartIndex);

let analysis;
try {
    analysis = JSON.parse(jsonString);
} catch (e) {
    console.error("JSON Parse Error:", e.message);
    process.exit(1);
}

const SLIDE_WIDTH = analysis.slide_width_inches;
const SLIDE_HEIGHT = analysis.slide_height_inches;

function toPct(val, total) {
    return (val / total) * 100;
}

const templates = {};

analysis.templates.forEach(slide => {
    const layoutName = slide.slide_index === 1 ? 'title' : 
                       slide.slide_index === 2 ? 'content' : 'grid';
    
    const elements = slide.elements.map(el => {
        // Normalize keys
        let key = 'unknown';
        
        // Heuristics to identify elements based on the analysis
        if (layoutName === 'title') {
            if (el.text === 'LOREM IPSUM') key = 'tagline';
            else if (el.name === 'Título 1') key = 'title';
            else if (el.name === 'TextBox 59') key = 'body';
        } else if (layoutName === 'content') {
            if (el.text === 'LOREM IPSUM') key = 'tagline';
            else if (el.name === 'Título 1') key = 'title';
            else if (el.name === 'TextBox 59') key = 'body';
        } else if (layoutName === 'grid') {
            if (el.text === 'LOREM IPSUM') key = 'tagline';
            else if (el.name === 'Título 1') key = 'title';
            else if (el.name === 'TextBox 59') key = 'intro';
            else if (el.text && el.text.match(/^[0-9]$/)) {
                 key = `number_${el.text}`;
            } else if (el.text === 'Lorem Ipsum') {
                 key = `item_title`; // We need to disambiguate these
            } else if (el.text.startsWith('Lorem ipsum')) {
                 key = `item_desc`;
            }
        }

        return {
            id: el.id,
            key: key,
            type: el.type,
            style: {
                left: toPct(el.left, SLIDE_WIDTH) + '%',
                top: toPct(el.top, SLIDE_HEIGHT) + '%',
                width: toPct(el.width, SLIDE_WIDTH) + '%',
                height: toPct(el.height, SLIDE_HEIGHT) + '%',
                fontSize: (el.paragraphs?.[0]?.runs?.[0]?.size || 12) + 'pt',
                color: '#' + (el.paragraphs?.[0]?.runs?.[0]?.color || '000000'),
                textAlign: el.paragraphs?.[0]?.alignment || 'left'
            },
            raw: {
                left: el.left,
                top: el.top,
                width: el.width,
                height: el.height
            },
            text: el.text
        };
    });

    // Post-processing for grid layout to group items
    if (layoutName === 'grid') {
        // Sort by top then left to group items
        // The grid items seem to be: Number, Icon, Title, Description
        // We can group them by proximity.
        // For now, let's just keep them as a flat list but give them unique keys based on index if needed.
        // Or better, let's just export the raw elements and let the renderer handle it?
        // No, the renderer needs to know which element is which to populate content.
        
        // Let's assign keys based on sorted position.
        const itemTitles = elements.filter(e => e.key === 'item_title').sort((a, b) => a.raw.top - b.raw.top || a.raw.left - b.raw.left);
        itemTitles.forEach((el, i) => el.key = `item_title_${i+1}`);
        
        const itemDescs = elements.filter(e => e.key === 'item_desc').sort((a, b) => a.raw.top - b.raw.top || a.raw.left - b.raw.left);
        itemDescs.forEach((el, i) => el.key = `item_desc_${i+1}`);
        
        const numbers = elements.filter(e => e.key.startsWith('number_'));
        // numbers are already keyed
    }

    templates[layoutName] = {
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        elements: elements
    };
});

const fileContent = `export const PPT_TEMPLATES = ${JSON.stringify(templates, null, 2)};`;

fs.writeFileSync(outputPath, fileContent);
console.log('Template config generated at ' + outputPath);
