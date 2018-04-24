'use strict';

var workflowModel = {
    initialStateId: null,
    finalStateIds: [],
    children: {
        C1: {
            key: 'C1',
            name: 'C1',
            parentId: null,
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['P1'],
            id: 'C1'
        },
        P1: {
            key: 'P1',
            name: 'Test state',
            parentId: null,
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: null,
            regionIds: ['R1', 'R2'],
            id: 'P1'
        },
        R1: {
            type: 'region',
            key: 'R1',
            name: 'R1',
            parentId: 'P1',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['C2', 'P5'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'R1'
        },
        R2: {
            type: 'region',
            key: 'R2',
            name: 'R2',
            parentId: 'P1',
            tracksHistory: false,
            initialStateId: '',
            finalStateIds: [''],
            childIds: ['C4'],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'R2'
        },
        C2: {
            key: 'C2',
            name: 'C2',
            parentId: 'R1',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['P2'],
            id: 'C2'
        },
        P5: {
            key: 'P1',
            name: 'Test state',
            parentId: 'R1',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: null,
            regionIds: ['R9', 'R10'],
            id: 'P1'
        },
        R9: {
            type: 'region',
            key: 'R9',
            name: 'R9',
            parentId: 'P5',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['DState'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'R9'
        },
        R10: {
            type: 'region',
            key: 'R10',
            name: 'R10',
            parentId: 'P5',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: [],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'R10'
        },
        DState: {
            key: 'DState',
            name: 'Test state',
            parentId: 'R9',
            guard: '',
            inTransitionIds: ['MoveFromAtoD'],
            outTransitionIds: [],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
            label: {},
            state: 'intermediate',
            id: 'DState'
        },
        P2: {
            key: 'P2',
            name: 'Test state',
            parentId: 'C2',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: null,
            regionIds: ['R3', 'R4'],
            id: 'P2'
        },
        R3: {
            type: 'region',
            key: 'R3',
            name: 'R3',
            parentId: 'P2',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['C3'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'R3'
        },
        R4: {
            type: 'region',
            key: 'R4',
            name: 'R4',
            parentId: 'P2',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['P3'],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'R4'
        },
        P3: {
            key: 'P3',
            name: 'Test state',
            parentId: 'R4',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: null,
            regionIds: ['R5', 'R6'],
            id: 'P3'
        },
        R5: {
            type: 'region',
            key: 'R5',
            name: 'R5',
            parentId: 'P3',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['BState'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'R5'
        },
        R6: {
            type: 'region',
            key: 'R6',
            name: 'R6',
            parentId: 'P3',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: [],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'R6'
        },
        BState: {
            key: 'BState',
            name: 'Test state',
            parentId: 'R5',
            guard: '',
            inTransitionIds: ['MoveFromAtoB'],
            outTransitionIds: [],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
            label: {},
            state: 'intermediate',
            id: 'BState'
        },
        C3: {
            key: 'C3',
            name: 'C3',
            parentId: 'R3',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['AState'],
            id: 'C3'
        },
        AState: {
            key: 'AState',
            name: 'Test state',
            parentId: 'C3',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromAtoD', 'MoveFromAtoB', 'MoveFromAtoC'],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
            label: {},
            state: 'intermediate',
            id: 'AState'
        },
        C4: {
            key: 'C4',
            name: 'C4',
            parentId: 'R2',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['C5'],
            id: 'C4'
        },
        C5: {
            key: 'C5',
            name: 'C5',
            parentId: 'C4',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['P4'],
            id: 'C5'
        },
        P4: {
            key: 'P4',
            name: 'Test state',
            parentId: 'C5',
            guard: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: null,
            regionIds: ['R7', 'R8'],
            id: 'P4'
        },
        R7: {
            type: 'region',
            key: 'R7',
            name: 'R7',
            parentId: 'P4',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: ['CState'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'R7'
        },
        R8: {
            type: 'region',
            key: 'R8',
            name: 'R8',
            parentId: 'P4',
            tracksHistory: false,
            initialStateId: null,
            finalStateIds: [],
            childIds: [],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'R8'
        },
        CState: {
            key: 'CState',
            name: 'Test state',
            parentId: 'R7',
            guard: '',
            inTransitionIds: ['MoveFromAtoC'],
            outTransitionIds: [],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
            label: {},
            state: 'intermediate',
            id: 'CState'
        }
    },
    transitions: {
        MoveFromAtoB: {
            type: 'transition',
            key: 'MoveFromAtoB',
            name: 'MoveFromAtoB',
            sourceStateId: 'AState',
            targetStateId: 'BState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 683,
                y: 136.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 683,
                    y: 136.5,
                    width: 73,
                    height: 12
                }
            },
            x: 612,
            y: 144,
            id: 'MoveFromAtoB'
        },
        MoveFromAtoC: {
            type: 'transition',
            key: 'MoveFromAtoC',
            name: 'MoveFromAtoC',
            sourceStateId: 'AState',
            targetStateId: 'CState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 836,
                y: 267,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 836,
                    y: 267,
                    width: 73,
                    height: 12
                }
            },
            x: 898,
            y: 196,
            id: 'MoveFromAtoC'
        },
        MoveFromAtoD: {
            type: 'transition',
            key: 'MoveFromAtoD',
            name: 'MoveFromAtoD',
            sourceStateId: 'AState',
            targetStateId: 'DState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 932,
                y: 405,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 932,
                    y: 405,
                    width: 73,
                    height: 12
                }
            },
            x: 1074,
            y: 413,
            id: 'MoveFromAtoD'
        }
    }
};

module.exports = workflowModel;
