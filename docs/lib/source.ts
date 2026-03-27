import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

export const source = loader(docs.toFumadocsSource(), {
  baseUrl: '/docs',
});
