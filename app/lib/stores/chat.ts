import { map } from 'nanostores';

interface ChatState {
  id: string;
  started: boolean;
  aborted: boolean;
  showChat: boolean;
  projectType: string;
  pendingMessage: string | null;
}

const defaultState: ChatState = {
  id: '', 
  started: false,
  aborted: false,
  showChat: true,
  projectType: '',
  pendingMessage: null,
};

export const chatStore = map<ChatState>('chat', defaultState);
