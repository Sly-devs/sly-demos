import { ChatApp } from './chat-app';
import { HOKA } from '@/lib/catalog';

export default function Page() {
  return (
    <ChatApp
      product={{
        id: HOKA.id,
        name: HOKA.name,
        tagline: HOKA.tagline,
        description: HOKA.description,
        category: HOKA.category,
        priceCents: HOKA.priceCents,
        currency: HOKA.currency,
      }}
    />
  );
}
