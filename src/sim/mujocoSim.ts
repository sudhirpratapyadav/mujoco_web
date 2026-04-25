import loadMujoco, { type MainModule, type MjModel, type MjData } from '@mujoco/mujoco';
import { loadAssetBundle } from './loadAssets';

export class MujocoSim {
  readonly mj: MainModule;
  readonly model: MjModel;
  readonly data: MjData;

  private constructor(mj: MainModule, model: MjModel, data: MjData) {
    this.mj = mj;
    this.model = model;
    this.data = data;
  }

  static async fromXmlString(xml: string): Promise<MujocoSim> {
    const mj = await loadMujoco();
    const model = mj.MjModel.from_xml_string(xml);
    const data = new mj.MjData(model);
    return new MujocoSim(mj, model, data);
  }

  /**
   * Load a model from a URL pointing at a directory containing `manifest.json`.
   * The manifest lists the root XML and all auxiliary files (sub-XMLs, meshes).
   */
  static async fromBundle(baseUrl: string): Promise<MujocoSim> {
    const mj = await loadMujoco();
    const xmlPath = await loadAssetBundle(mj, baseUrl);
    const model = mj.MjModel.from_xml_path(xmlPath);
    const data = new mj.MjData(model);
    return new MujocoSim(mj, model, data);
  }

  /** Advance one physics timestep. */
  step(): void {
    this.mj.mj_step(this.model, this.data);
  }

  /** Advance n timesteps. Cheaper than n separate calls because it stays in WASM. */
  stepN(n: number): void {
    for (let i = 0; i < n; i++) this.mj.mj_step(this.model, this.data);
  }

  /** Live view into qpos (don't store across structural changes). */
  get qpos(): Float64Array {
    return this.data.qpos as unknown as Float64Array;
  }

  get qvel(): Float64Array {
    return this.data.qvel as unknown as Float64Array;
  }

  get time(): number {
    return this.data.time;
  }

  /** Free the underlying WASM-heap objects. */
  dispose(): void {
    this.data.delete();
    this.model.delete();
  }
}
