import React, { useState } from 'react';
import ForgeReconciler, { Box, EmptyState, Stack } from '@forge/react';
import { PivotTable } from './table';
import { FilterForm } from './filter';


const Global = () => {
    const [filters, setFilters] = useState({});

    return (
        <Box display="flex" justifyContent="center" alignItems="center">
            <Stack space='space.200'>
                <FilterForm onFilterChange={setFilters} />
                {Object.keys(filters).length === 0 ?
                    <EmptyState
                        header="Nothing Here Yet"
                        description="Use the filters above to search for worklog information."
                    /> :
                    <PivotTable filters={filters} />
                }
            </Stack>
        </Box>
    );
};

ForgeReconciler.render(
    <React.StrictMode>
        <Global />
    </React.StrictMode>
);