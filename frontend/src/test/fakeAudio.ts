import { vi } from "vitest";
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "../audio/engine";
import type { OscillatorKind } from "../audio/recipes";

export interface ParamEvent {
  readonly kind: "set" | "linear" | "exponential" | "target";
  readonly value: number;
  readonly time: number;
}

export class FakeParam implements AudioParamLike {
  value = 0;
  readonly events: ParamEvent[] = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: "linear", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: "exponential", value, time });
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "target", value, time });
  }
  /** The value the last setTargetAtTime aimed at, or the plain value. */
  get target(): number {
    const targets = this.events.filter((event) => event.kind === "target");
    return targets.length === 0
      ? this.value
      : targets[targets.length - 1].value;
  }
}

export class FakeNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = [];
  connect(destination: AudioNodeLike) {
    this.connections.push(destination);
    return destination;
  }
}

export class FakeGain extends FakeNode implements GainNodeLike {
  readonly gain = new FakeParam();
}

export class FakeOscillator extends FakeNode implements OscillatorNodeLike {
  type: OscillatorKind = "sine";
  readonly frequency = new FakeParam();
  startTime: number | null = null;
  stopTime: number | null = null;
  start(when: number) {
    this.startTime = when;
  }
  stop(when: number) {
    this.stopTime = when;
  }
}

export class FakeAudioContext implements AudioContextLike {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  state: "suspended" | "running" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  resumeCalls = 0;
  suspendCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  resume() {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.suspendCalls += 1;
    this.state = "suspended";
    return Promise.resolve();
  }

  /** The engine builds master, effects and music buses first, in that order. */
  get master(): FakeGain {
    return this.gains[0];
  }
  get effectsBus(): FakeGain {
    return this.gains[1];
  }
  get musicBus(): FakeGain {
    return this.gains[2];
  }
  /** Oscillators whose envelope feeds the given bus. */
  oscillatorsOn(bus: FakeGain): FakeOscillator[] {
    return this.oscillators.filter((oscillator) =>
      oscillator.connections.some(
        (envelope) => (envelope as FakeNode).connections[0] === bus,
      ),
    );
  }
  /** First frequency of every effect oscillator, in creation order. */
  effectFrequencies(): number[] {
    return this.oscillatorsOn(this.effectsBus).map(
      (oscillator) => oscillator.frequency.events[0].value,
    );
  }
}

/** Installs the fake as window.AudioContext; returns the class for inspection. */
export function installFakeAudio(): typeof FakeAudioContext {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return FakeAudioContext;
}
