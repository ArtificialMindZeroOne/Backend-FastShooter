import { v4 as uuidv4 } from 'uuid';

export function generateId(prefix = 'id') {
    return `${prefix}-${uuidv4()}`;
}
