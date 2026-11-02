import { useState } from 'react';
import { Box } from '@mui/material';

import type { Professional } from '../components/availability/availabilityConfig';
import { TeamAvailabilityCard } from '../components/availability/TeamAvailabilityCard';
import { UnavailabilityBlocksCard } from '../components/availability/UnavailabilityBlocksCard';
import { UnavailabilityDialog } from '../components/availability/UnavailabilityDialog';
import { useAvailabilityData } from '../components/availability/useAvailabilityData';
import { WorkingHoursDialog } from '../components/availability/WorkingHoursDialog';

export function Availability() {
  const { me, canEditOthers, usersLoading, professionals, colorOf, hoursQueries, unavailLoading, blocks, removeBlock } =
    useAvailabilityData();

  const [editing, setEditing] = useState<Professional | null>(null);
  const [unavailDialogOpen, setUnavailDialogOpen] = useState(false);

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' },
          gap: 2.25,
          alignItems: 'start',
        }}
      >
        <Box data-tour="hours-team">
        <TeamAvailabilityCard
          title={canEditOthers ? 'Disponibilidade da equipe' : 'Minha disponibilidade'}
          loading={canEditOthers && usersLoading}
          professionals={professionals}
          hoursQueries={hoursQueries}
          colorOf={colorOf}
          onEdit={setEditing}
        />
        </Box>

        <Box data-tour="hours-blocks">
        <UnavailabilityBlocksCard
          loading={unavailLoading}
          blocks={blocks}
          colorOf={colorOf}
          onAdd={() => setUnavailDialogOpen(true)}
          onRemove={(b) => removeBlock({ userId: b.professional.id, id: b.id })}
        />
        </Box>
      </Box>

      <WorkingHoursDialog professional={editing} onClose={() => setEditing(null)} />

      <UnavailabilityDialog
        open={unavailDialogOpen}
        onClose={() => setUnavailDialogOpen(false)}
        professionals={professionals}
        defaultUserId={me?.id ?? professionals[0]?.id ?? ''}
        canChooseProfessional={canEditOthers}
      />
    </Box>
  );
}
