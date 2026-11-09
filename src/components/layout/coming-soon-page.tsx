import { Page } from '@/components/layout/page';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getNavItem } from '@/constants/navigation';

/** Placeholder for pages that aren't built yet, styled from the page's nav item. */
export function ComingSoonPage({ name }: { name: string }) {
  const item = getNavItem(name);

  return (
    <Page>
      <Card>
        <EmptyState
          icon={item.icon}
          tint={item.tint}
          title={`${item.label} is coming soon`}
          description={item.description}
        />
      </Card>
    </Page>
  );
}
