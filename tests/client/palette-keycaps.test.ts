import test from 'node:test';import assert from 'node:assert/strict';import {paletteShortcutParts} from '../../src/client/palette-keycaps';
test('native sequential shortcuts render then while chord shortcuts do not',()=>{assert.deepEqual(paletteShortcutParts('N P'),[{key:'N',separator:false},{key:'then',separator:true},{key:'P',separator:false}]);assert.deepEqual(paletteShortcutParts('⌃ R'),[{key:'Ctrl',separator:false},{key:'R',separator:false}]);assert.deepEqual(paletteShortcutParts('⌘ F'),[{key:'⌘',separator:false},{key:'F',separator:false}]);assert.deepEqual(paletteShortcutParts(''),[]);});

test('native open and go sequences retain the explicit then separator',()=>{for(const chord of ['O I','G X','P S'])assert.equal(paletteShortcutParts(chord)[1].separator,true);});
