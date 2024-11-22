import { MODIFICATIONS_TAG_NAME, WORK_DIR } from '~/utils/constants';

import { stripIndents } from '~/utils/stripIndent';

import { getNodeSystemPrompt } from './project_prompts/node_project';
import { getPythonSystemPrompt } from './project_prompts';
import { getRSystemPrompt } from './project_prompts';
import { getEngineeringSystemPrompt } from './project_prompts';
import { getMolecularSystemPrompt } from './project_prompts';
import { getAISystemPrompt } from './project_prompts';
import { getBioSystemPrompt } from './project_prompts';
import { getMathlibSystemPrompt } from './project_prompts';

export const getSystemPrompt = (projectType: string = '', cwd: string = WORK_DIR) => {
  switch (projectType) {
    case 'python':
      return getPythonSystemPrompt(cwd);
    case 'r':
      return getRSystemPrompt(cwd); 
    case 'engineering':
      return getEngineeringSystemPrompt(cwd);
    case 'molecular':
      return getMolecularSystemPrompt(cwd);
    case 'ai':
      return getAISystemPrompt(cwd);
    case 'bio':
      return getBioSystemPrompt(cwd);
    case 'mathlib':
      return getMathlibSystemPrompt(cwd);
    default:
      return getNodeSystemPrompt(cwd);
  }
};

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;
