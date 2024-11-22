import { useStore } from '@nanostores/react';
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { chatStore } from '~/lib/stores/chat';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

export default function Index() {
  const isBrowser = typeof window !== 'undefined';
  const { id } = useLoaderData<typeof loader>();
  const { projectType } = useStore(chatStore);
  // console.log('==projectType=', projectType, id);
  if (isBrowser && id) {
    chatStore.setKey('id', id);
    if (projectType) {
      localStorage.setItem(id + '_project_type', projectType);
    } else {
      const p = localStorage.getItem(id + '_project_type');
      if (p) {
      chatStore.setKey('projectType', p);
      }
    }
    // console.log('==projectType2=', projectType, id);
  }
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<BaseChat selectedProjectType={projectType} />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
