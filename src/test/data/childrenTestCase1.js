'use strict';

var workflowModel = {
    initialStateId: 'EState',
    finalStateIds: ['DState', 'JState'],
    children: {
        compState1: {
            key: 'compState1',
            name: 'compState1',
            parentId: null,
            guard: 'rate <= year',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromCompState1to2', 'MoveFromComp1toPar1'],
            gfx: {
                x: 391,
                y: 69,
                width: 226,
                height: 133
            },
            type: 'compound-state',
            finalTransitionsToId: 'par1',
            tracksHistory: false,
            initialStateId: 'AState',
            finalStateIds: ['BState'],
            childIds: ['AState', 'BState'],
            id: 'compState1'
        },
        AState: {
            key: 'AState',
            name: 'AState',
            parentId: 'compState1',
            guard: 'rate >= intrest',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromAtoB'],
            gfx: {
                x: 409,
                y: 163,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: true,
            isFinal: false,
            label: {
                bounds: {
                    x: 409,
                    y: 163,
                    width: 49,
                    height: 12
                }
            },
            state: 'start',
            id: 'AState'
        },
        BState: {
            key: 'BState',
            name: 'BState',
            parentId: 'compState1',
            guard: 'rate > intrest',
            guardMessage: '',
            inTransitionIds: ['MoveFromAtoB'],
            outTransitionIds: [],
            gfx: {
                x: 541,
                y: 163,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: true,
            label: {
                bounds: {
                    x: 541,
                    y: 163,
                    width: 49,
                    height: 12
                }
            },
            state: 'final',
            id: 'BState'
        },
        compState2: {
            key: 'compState2',
            name: 'compState2',
            parentId: null,
            guard: '(rate > year)  ',
            guardMessage: '',
            inTransitionIds: ['MoveFromCompState1to2'],
            outTransitionIds: [],
            gfx: {
                x: 793,
                y: 64,
                width: 233,
                height: 137
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: true,
            initialStateId: 'CState',
            finalStateIds: [],
            childIds: ['CState'],
            id: 'compState2'
        },
        CState: {
            key: 'CState',
            name: 'CState',
            parentId: 'compState2',
            guard: '',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromCtoD'],
            gfx: {
                x: 881,
                y: 157,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: true,
            isFinal: false,
            label: {
                bounds: {
                    x: 881,
                    y: 157,
                    width: 49,
                    height: 12
                }
            },
            state: 'start',
            id: 'CState'
        },
        par1: {
            key: 'par1',
            name: 'par1',
            parentId: null,
            guard: 'rate > year',
            guardMessage: 'transition not allowed as rate is less than year',
            inTransitionIds: ['MoveFromComp1toPar1', 'MoveFromDtoPar1'],
            outTransitionIds: ['MoveFromPar1toJ'],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: 'JState',
            regionIds: ['reg1', 'reg2'],
            id: 'par1'
        },
        reg1: {
            type: 'region',
            key: 'reg1',
            name: 'reg1',
            parentId: 'par1',
            tracksHistory: false,
            initialStateId: 'FState',
            finalStateIds: ['GState'],
            childIds: ['FState', 'GState'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'reg1'
        },
        reg2: {
            type: 'region',
            key: 'reg2',
            name: 'reg2',
            parentId: 'par1',
            tracksHistory: true,
            initialStateId: 'HState',
            finalStateIds: ['IState'],
            childIds: ['HState', 'IState'],
            gfx: {
                x: 390,
                y: 502,
                width: 180,
                height: 120
            },
            id: 'reg2'
        },
        FState: {
            key: 'FState',
            name: 'FState',
            parentId: 'reg1',
            guard: '',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromFtoG'],
            gfx: {
                x: 409,
                y: 466,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: true,
            isFinal: false,
            label: {
                bounds: {
                    x: 409,
                    y: 466,
                    width: 49,
                    height: 12
                }
            },
            state: 'start',
            id: 'FState'
        },
        GState: {
            key: 'GState',
            name: 'GState',
            parentId: 'reg1',
            guard: '',
            guardMessage: '',
            inTransitionIds: ['MoveFromFtoG'],
            outTransitionIds: [],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: true,
            label: {},
            state: 'intermediate',
            id: 'GState'
        },
        HState: {
            key: 'HState',
            name: 'HState',
            parentId: 'reg2',
            guard: '',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromHtoI'],
            gfx: {
                x: 494,
                y: 466,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: true,
            isFinal: true,
            label: {
                bounds: {
                    x: 494,
                    y: 466,
                    width: 49,
                    height: 12
                }
            },
            state: 'final',
            id: 'HState'
        },
        IState: {
            key: 'IState',
            name: 'IState',
            parentId: 'reg2',
            guard: '',
            guardMessage: '',
            inTransitionIds: ['MoveFromHtoI'],
            outTransitionIds: [],
            gfx: {
                x: 412,
                y: 574,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: true,
            label: {
                bounds: {
                    x: 412,
                    y: 574,
                    width: 49,
                    height: 12
                }
            },
            state: 'start',
            id: 'IState'
        },
        DState: {
            key: 'DState',
            name: 'DState',
            parentId: null,
            guard: '',
            guardMessage: '',
            inTransitionIds: ['MoveFromCtoD', 'MoveFromEtoD'],
            outTransitionIds: ['MoveFromDtoPar1'],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: true,
            label: {},
            state: 'final',
            id: 'DState'
        },
        EState: {
            key: 'EState',
            name: 'EState',
            parentId: null,
            guard: '',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: ['MoveFromEtoD'],
            gfx: {
                x: 498,
                y: 574,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: true,
            isFinal: false,
            label: {
                bounds: {
                    x: 498,
                    y: 574,
                    width: 49,
                    height: 12
                }
            },
            state: 'start',
            id: 'EState'
        },
        JState: {
            key: 'JState',
            name: 'JState',
            parentId: null,
            guard: '',
            guardMessage: '',
            inTransitionIds: ['MoveFromPar1toJ'],
            outTransitionIds: [],
            gfx: {
                x: 824,
                y: 432,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: true,
            label: {
                bounds: {
                    x: 824,
                    y: 432,
                    width: 49,
                    height: 12
                }
            },
            state: 'final',
            id: 'JState'
        },
        KState: {
            key: 'KState',
            name: 'KState',
            parentId: null,
            guard: '',
            guardMessage: '',
            inTransitionIds: ['MoveFromKtoK'],
            outTransitionIds: ['MoveFromKtoK'],
            gfx: {
                x: 824,
                y: 432,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
            label: {
                bounds: {
                    x: 824,
                    y: 432,
                    width: 49,
                    height: 12
                }
            },
            state: 'intermediate',
            id: 'KState'
        }
    },
    transitions: {
        MoveFromCompState1to2: {
            type: 'transition',
            key: 'MoveFromCompState1to2',
            name: 'MoveFromCompState1to2',
            sourceStateId: 'compState1',
            targetStateId: 'compState2',
            withHistory: true,
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
            id: 'MoveFromCompState1to2'
        },
        MoveFromAtoB: {
            type: 'transition',
            key: 'MoveFromAtoB',
            name: 'MoveFromAtoB',
            sourceStateId: 'AState',
            targetStateId: 'BState',
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
            id: 'MoveFromAtoB'
        },
        MoveFromCtoD: {
            type: 'transition',
            key: 'MoveFromCtoD',
            name: 'MoveFromCtoD',
            sourceStateId: 'CState',
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
            id: 'MoveFromCtoD'
        },
        MoveFromComp1toPar1: {
            type: 'transition',
            key: 'MoveFromComp1toPar1',
            name: 'MoveFromComp1toPar1',
            sourceStateId: 'compState1',
            targetStateId: 'par1',
            withHistory: false,
            isAuto: true,
            gfx: {
                x: 675,
                y: 377.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 675,
                    y: 377.5,
                    width: 73,
                    height: 12
                }
            },
            x: 856,
            y: 404,
            id: 'MoveFromComp1toPar1'
        },
        MoveFromFtoG: {
            type: 'transition',
            key: 'MoveFromFtoG',
            name: 'MoveFromFtoG',
            sourceStateId: 'FState',
            targetStateId: 'GState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 455,
                y: 428.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 455,
                    y: 428.5,
                    width: 73,
                    height: 12
                }
            },
            x: 422,
            y: 440,
            id: 'MoveFromFtoG'
        },
        MoveFromHtoI: {
            type: 'transition',
            key: 'MoveFromHtoI',
            name: 'MoveFromHtoI',
            sourceStateId: 'HState',
            targetStateId: 'IState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 443,
                y: 524.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 443,
                    y: 524.5,
                    width: 73,
                    height: 12
                }
            },
            x: 441,
            y: 550,
            id: 'MoveFromHtoI'
        },
        MoveFromDtoPar1: {
            type: 'transition',
            key: 'MoveFromDtoPar1',
            name: 'MoveFromDtoPar1',
            sourceStateId: 'DState',
            targetStateId: 'par1',
            withHistory: true,
            isAuto: false,
            gfx: {
                x: 443,
                y: 524.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 443,
                    y: 524.5,
                    width: 73,
                    height: 12
                }
            },
            x: 441,
            y: 550,
            id: 'MoveFromDtoPar1'
        },
        MoveFromEtoD: {
            type: 'transition',
            key: 'MoveFromEtoD',
            name: 'MoveFromEtoD',
            sourceStateId: 'EState',
            targetStateId: 'DState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 443,
                y: 524.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 443,
                    y: 524.5,
                    width: 73,
                    height: 12
                }
            },
            x: 441,
            y: 550,
            id: 'MoveFromEtoD'
        },
        MoveFromKtoK: {
            type: 'transition',
            key: 'MoveFromKtoK',
            name: 'MoveFromKtoK',
            sourceStateId: 'KState',
            targetStateId: 'KState',
            withHistory: false,
            isAuto: false,
            gfx: {
                x: 443,
                y: 524.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 443,
                    y: 524.5,
                    width: 73,
                    height: 12
                }
            },
            x: 441,
            y: 550,
            id: 'MoveFromKtoK'
        },
        MoveFromPar1toJ: {
            type: 'transition',
            key: 'MoveFromPar1toJ',
            name: 'MoveFromPar1toJ',
            sourceStateId: 'par1',
            targetStateId: 'JState',
            withHistory: false,
            isAuto: true,
            gfx: {
                x: 443,
                y: 524.5,
                width: 73,
                height: 12
            },
            label: {
                bounds: {
                    x: 443,
                    y: 524.5,
                    width: 73,
                    height: 12
                }
            },
            x: 441,
            y: 550,
            id: 'MoveFromPar1toJ'
        }

    // 'MoveFromAtoComp1': {

    //                 'type': 'transition',

    //                 'key': 'MoveFromAtoComp1',

    //                 'name': 'MoveFromAtoComp1',

    //                 'sourceStateId': 'AState',

    //                 'targetStateId': 'compState1',

    //                 'withHistory': false,

    //                 'isAuto': false,

    //                 'gfx': {

    //                                 'x': 443,

    //                                 'y': 524.5,

    //                                 'width': 73,

    //                                 'height': 12

    //                 },

    //                 'label': {

    //                                 'bounds': {

    //                                                 'x': 443,

    //                                                 'y': 524.5,

    //                                                 'width': 73,

    //                                                 'height': 12

    //                                 }

    //                 },

    //                 'x': 441,

    //                 'y': 550,

    //                 'id': 'MoveFromAtoComp1'

    // }
    }
};

module.exports = workflowModel;
