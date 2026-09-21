import waterVertexSource from './water.vert.glsl?raw';
import waterFragmentSource from './water.frag.glsl?raw';

export const shaderFiles = [
  { path: 'src/shaders/water.vert.glsl', stage: 'vertex', source: waterVertexSource },
  { path: 'src/shaders/water.frag.glsl', stage: 'fragment', source: waterFragmentSource },
];
