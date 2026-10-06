import globals from 'globals';
import base from './base.js';

// El propio paquete se analiza con la config base (son módulos ESM que se ejecutan en Node).
export default [...base, { languageOptions: { globals: { ...globals.node } } }];
