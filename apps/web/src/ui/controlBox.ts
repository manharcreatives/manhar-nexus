/** The shared look of a text control's box: a border you can see in a dim room (3.8:1), brighter on hover. */
export const controlBox = (error: boolean): string => (error ? 'border-bad' : 'border-control hover:border-control-hover');
