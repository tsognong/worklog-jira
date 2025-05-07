import React from 'react';
import {
    Modal,
    ModalBody,
    ModalTransition,
    ModalTitle,
    ModalFooter,
    ModalHeader,
    DynamicTable,
    Link,
    Spinner,
    Box,
    Button, // You might need Button for the ModalFooter
} from "@forge/react";

const WorklogDetailsModal = ({ modalOpen, setModalOpen, selectedDetails, jiraBaseUrl }) => (
    <ModalTransition>
        {modalOpen && (
            <Modal
                onClose={() => setModalOpen(false)}
                shouldScrollInViewport
                appearance="default"
            >
                <ModalHeader>
                    <ModalTitle>
                        {selectedDetails
                            ? `Details for ${selectedDetails.author} on ${selectedDetails.date}`
                            : "Loading Details..."}
                    </ModalTitle>
                </ModalHeader>
                <ModalBody>
                    {selectedDetails ? (
                        <DynamicTable
                            head={{
                                cells: [
                                    { key: 'project', content: 'Project' },
                                    { key: 'component', content: 'Component' },
                                    { key: 'ticket', content: 'Ticket' },
                                    { key: 'hours', content: 'Hours' },
                                ],
                            }}
                            rows={selectedDetails.details.map((item, index) => ({
                                key: index.toString(),
                                cells: [
                                    { key: 'project', content: item.project },
                                    { key: 'component', content: item.component },
                                    {
                                        key: 'ticket',
                                        content: (
                                            <Link
                                                href={`${jiraBaseUrl}/browse/${item.ticket}`}
                                                openNewTab={true}
                                            >
                                                {item.ticket}
                                            </Link>
                                        ),
                                    },
                                    { key: 'hours', content: item.hours },
                                ],
                            }))}
                            isFixedSize
                        />
                    ) : (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100px">
                            <Spinner size="medium" />
                        </Box>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button onClick={() => setModalOpen(false)}>Close</Button>
                    {/* You can add other footer actions here if needed */}
                </ModalFooter>
            </Modal>
        )}
    </ModalTransition>
);

export default WorklogDetailsModal;