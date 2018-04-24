'use strict';
var workflowModel = {
    initialStateId: 'compState1',
    finalStateIds: ['par1', 'JState'],
    children: {
        compState1: {
            key: 'compState1',
            name: 'compState1',
            parentId: null,
            guard: 'rate <= year',
            guardMessage: '',
            inTransitionIds: ['MoveFromAtoComp1', 'MoveFromComp1toComp1'],
            outTransitionIds: [
                'MoveFromCompState1to2',
                'MoveFromComp1toPar1',
                'MoveFromComp1toComp1'
            ],
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
            outTransitionIds: ['MoveFromAtoB', 'MoveFromAtoComp1'],
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
            guardMessage: '  sg  fsd  ',
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
            guardMessage: '       ',
            inTransitionIds: ['MoveFromCompState1to2'],
            outTransitionIds: ['MoveFromComp2toPar2', 'MoveFromComp2toD'],
            gfx: {
                x: 793,
                y: 64,
                width: 233,
                height: 137
            },
            type: 'compound-state',
            finalTransitionsToId: null,
            tracksHistory: false,
            initialStateId: 'CState',
            finalStateIds: [],
            childIds: ['CState'],
            id: 'compState2'
        },
        CState: {
            key: 'CState',
            name: 'CState',
            parentId: 'compState2',
            guard: ' pqr',
            guardMessage: 'abc',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 881,
                y: 157,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
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
        XState: {
            key: 'XState',
            name: 'XState',
            parentId: 'compState2',
            guard: 'abc',
            guardMessage: '',
            inTransitionIds: [],
            outTransitionIds: [],
            gfx: {
                x: 881,
                y: 157,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
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
            tracksHistory: false,
            initialStateId: 'HState',
            finalStateIds: null,
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
            inTransitionIds: ['MoveFromFtoG', 'MoveFromItoG'],
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
            outTransitionIds: ['MoveFromItoG'],
            gfx: {
                x: 412,
                y: 574,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
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
            inTransitionIds: ['MoveFromComp2toD', 'MoveFromEtoD'],
            outTransitionIds: ['MoveFromDtoPar1'],
            gfx: {},
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
            isFinal: false,
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
            inTransitionIds: ['MoveFromPar2toE'],
            outTransitionIds: ['MoveFromEtoD'],
            gfx: {
                x: 498,
                y: 574,
                width: 49,
                height: 12
            },
            type: 'atomic-state',
            resetHistory: false,
            isInitial: false,
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
        },
        par2: {
            key: 'par2',
            name: 'par2',
            parentId: null,
            guard: 'rate > year',
            guardMessage: 'transition not allowed as rate is less than year',
            inTransitionIds: ['MoveFromComp2toPar2', 'MoveFromPar2toPar2'],
            outTransitionIds: ['MoveFromPar2toE', 'MoveFromPar2toPar2'],
            gfx: {
                x: 390,
                y: 357,
                width: 180,
                height: 265
            },
            type: 'parallel-state',
            finalTransitionsToId: 'EState',
            regionIds: ['reg3'],
            id: 'par2'
        },
        reg3: {
            type: 'region',
            key: 'reg3',
            name: 'reg3',
            parentId: 'par2',
            tracksHistory: false,
            initialStateId: 'reg4',
            finalStateIds: ['reg4'],
            childIds: ['reg4'],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'reg3'
        },
        reg4: {
            type: 'region',
            key: 'reg4',
            name: 'reg4',
            parentId: 'par2',
            tracksHistory: false,
            initialStateId: '',
            childIds: [''],
            gfx: {
                x: 390,
                y: 382,
                width: 180,
                height: 120
            },
            id: 'reg4'
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
            withHistory: true,
            isAuto: true,
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
        MoveFromComp2toD: {
            type: 'transition',
            key: 'MoveFromComp2toD',
            name: 'MoveFromComp2toD',
            sourceStateId: 'compState2',
            targetStateId: 'DState',
            withHistory: false,
            isAuto: true,
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
            id: 'MoveFromComp2toD'
        },
        MoveFromComp1toPar1: {
            type: 'transition',
            key: 'MoveFromComp1toPar1',
            name: 'MoveFromComp1toPar1',
            sourceStateId: 'compState1',
            targetStateId: 'par1',
            withHistory: false,
            isAuto: false,
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
        MoveFromItoG: {
            type: 'transition',
            key: 'MoveFromItoG',
            name: 'MoveFromItoG',
            sourceStateId: 'IState',
            targetStateId: 'GState',
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
            id: 'MoveFromItoG'
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
            withHistory: true,
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
            id: 'MoveFromPar1toJ'
        },
        MoveFromAtoComp1: {
            type: 'transition',
            key: 'MoveFromAtoComp1',
            name: 'MoveFromAtoComp1',
            sourceStateId: 'AState',
            targetStateId: 'compState1',
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
            id: 'MoveFromAtoComp1'
        },
        MoveFromComp2toPar2: {
            type: 'transition',
            key: 'MoveFromComp2toPar2',
            name: 'MoveFromComp2toPar2',
            sourceStateId: 'compState2',
            targetStateId: 'par2',
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
            id: 'MoveFromComp2toPar2'
        },
        MoveFromPar2toE: {
            type: 'transition',
            key: 'MoveFromPar2toE',
            name: 'MoveFromPar2toE',
            sourceStateId: 'par2',
            targetStateId: 'EState',
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
            id: 'MoveFromPar2toE'
        },
        MoveFromPar2toPar2: {
            type: 'transition',
            key: 'MoveFromPar2toPar2',
            name: 'MoveFromPar2toPar2',
            sourceStateId: 'par2',
            targetStateId: 'par2',
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
            id: 'MoveFromPar2toPar2'
        },
        MoveFromComp1toComp1: {
            type: 'transition',
            key: 'MoveFromComp1toComp1',
            name: 'MoveFromComp1toComp1',
            sourceStateId: 'compState1',
            targetStateId: 'compState1',
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
            id: 'MoveFromComp1toComp1'
        }
    }
};

module.exports = workflowModel;
