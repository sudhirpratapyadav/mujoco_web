# 3DGS Sources for Harsh-Environment Robot Navigation — Survey

> Generated 2026-05-13. Links only, no data downloaded. Format compatibility refers to Spark (@sparkjsdev/spark v2) which reads .spz / .ply / .ksplat / .rad (plus .splat, .sog, .zip per docs).

Scope reminder: "harsh env for navigation" = `outdoor-unstructured` (forest, rubble, off-road, slopes), `indoor-degraded` (collapsed buildings, tunnels, subterranean, debris), `low-visibility` (night, fog, smoke, dust, rain), `large-scale` (city block / multi-hundred-metre / streaming-LOD). Entries marked `general` are mixed-content libraries with no specific harsh-env focus.

---

## 1. Hosted / streaming services

These services let users generate or host GS scenes. Key question: can a developer pull a stable HTTPS URL to the splat asset, or is the asset locked behind a player/SDK?

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| World Labs Marble | https://marble.worldlabs.ai/ | general (synthetic worlds) | `.spz` / `.ply` export; streaming via Spark from worldlabs CDN | Per-account TOS; commercial tier exists | Streaming pipeline confirmed (April 2026 blog `worldlabs.ai/blog/spark-2.0`). User-generated worlds; harsh-env content depends on prompt. Stable CDN URLs work in practice (already used by the project). |
| Luma AI | https://lumalabs.ai/ | general (mostly object/indoor user captures) | `.ply` download from web UI; Enterprise API for programmatic GS; legacy `.luma` interactive scenes require Luma WebGL Library | TOS, account-bound | PLY download is supported but originally proprietary `.luma` packaging required SDK. Interactive scene URLs (`captures.lumalabs.ai/...`) are not raw splat files. Flag: needs export. |
| Polycam | https://poly.cam/tools/gaussian-splatting | general (objects, sites, scans) | `.ply` export (Pro tier); embeddable viewer URL but no documented stable raw-PLY CDN URL | Free + paid tiers; user owns content | Public gallery exists, but for fetchable URL you typically download → re-host. Mobile capture good for ad-hoc harsh-env scans. |
| Scaniverse (Niantic) | https://scaniverse.com/ | general (largely outdoor, some unstructured) | `.spz` / `.ply` export from app; share URLs go through Scaniverse viewer, not direct file | Free; account-bound sharing | Native `.spz` producer. Public scene URLs aren't raw splat downloads — needs manual export then self-hosting. |
| KIRI Engine | https://www.kiriengine.app/features/3d-gaussian-splatting | general (objects/scenes) | `.ply` (and mesh export); cloud processing | Free + Pro tiers | Mobile + web. No documented public CDN for raw splat URLs; export-then-host workflow. |
| Postshot (Jawset) | https://www.jawset.com/ | general (whatever you capture) | Desktop trainer, exports `.ply` (Splat3 / MCMC profiles) | Commercial license; free tier | Not a host — local training. Listed because it's the dominant desktop pipeline for producing harsh-env splats from your own footage. |
| Spline | https://spline.design/ | general (design-oriented) | Imports `.ply` (≤480 MB), exports embed for web; not a raw-URL host | SaaS, account-bound | Mostly synthetic / stylised design content; weak fit for harsh-env. |
| PlayCanvas SuperSplat (publish) | https://superspl.at/ | general | Publishes `.ply`/`.sog`/`.compressed.ply`; public scenes can be embedded; viewer fetches a backing asset URL | Free for public, paid private | Public scenes' underlying asset URLs are reachable (the embed pulls them), but URLs are not officially documented as a stable API — caveat emptor. |
| Sketchfab (GS-tagged) | https://sketchfab.com/tags/gaussiansplatt | general | `.ply` / occasionally USDZ download per asset; creator-controlled | Per-asset license (CC variants common) | Filter by `gaussian` or `gaussiansplatt` tags. Most assets are objects; few harsh-env. |
| LikeThereInReal | https://likethereinreal.com/ | general (mostly stylised worlds) | Streaming GS player, no documented raw URL | Commercial | Built on World Labs / Marble-style pipelines. Listed for completeness; not a developer-facing splat CDN. |

Related-but-not-GS-hosting (excluded from above): RealityCapture, Pix4D, Metashape (photogrammetry mesh output, not GS by default — though Pix4D has begun publishing 3DGS articles for utilities work).

---

## 2. Pre-made downloadable GS scenes (libraries, galleries, hubs)

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| SuperSplat public gallery | https://superspl.at/ | general | Browser viewer; underlying `.compressed.ply` / `.sog` URLs reachable | Per-creator | Largest curated GS gallery as of 2026. Search for outdoor/landmark terms. |
| Hugging Face — Voxel51 GS | https://huggingface.co/datasets/Voxel51/gaussian_splatting | general | `.ply` files | Apache-2.0 (per Voxel51 mirror) | Multiple real-world scenes reconstructed via reference 3DGS impl. |
| Hugging Face — InteriorGS | https://huggingface.co/datasets/spatialverse/InteriorGS | indoor-general (not degraded) | `3dgs_compressed.ply` per scene | Per dataset card | 1,000 indoor scenes — useful baseline for indoor degradation finetuning, NOT harsh out of the box. |
| Hugging Face — SceneSplat-7K | https://huggingface.co/datasets/GaussianWorld/scene_splat_7k | indoor-general | GS scenes from ScanNet, ScanNet++, Replica, Hypersim, ARKitScenes etc. | Inherits source dataset licenses | Same caveat as InteriorGS — clean indoor, not degraded. |
| Hugging Face — SceneSplat-49K | https://huggingface.co/datasets/GaussianWorld/scene_splat_49k | indoor-general | Larger version of above | Inherits source dataset licenses | Bulk indoor splat corpus. |
| antimatter15 sample scenes | https://antimatter15.com/splat/ | general (object/landmark) | `.splat` / `.ply` over HTTPS, e.g. `?url=plush.splat` | Demo scenes, attribution | Useful for plumbing tests; not harsh content. |
| mkkellogg GaussianSplats3D demos | https://github.com/mkkellogg/GaussianSplats3D | general | `.ply` / `.ksplat` sample assets in repo | MIT (code) | Reference for `.ksplat` format that Spark also reads. |
| MrNeRF awesome-3D-gaussian-splatting | https://github.com/MrNeRF/awesome-3D-gaussian-splatting | general (index) | Index page only | List | Best starting point for "is there a release for paper X?" lookups. |
| longxiang-ai awesome-gaussians | https://github.com/longxiang-ai/awesome-gaussians | general (index) | Daily arxiv tracker | List | Complements MrNeRF list with auto-updating recent papers. |
| 3DGS_and_Beyond_Docs | https://github.com/yangjiheng/3DGS_and_Beyond_Docs | general (index, Chinese-focused) | List | List | Cross-lingual index; useful for finding China-side releases. |
| 3DGS.dev hub | https://3dgs.dev/ | general | Tutorial / curation site | n/a | Editorial; occasional scene drops. |
| SuperSplat featured "Moon Artemis II" | https://superspl.at/scene/ (search "Moon") | general (planetary analog) | Public scene; embed URL fetchable | NASA-derived imagery | Closest "alien terrain" analog with a real public GS scene. Worth treating as a Mars-analog stand-in. |
| MatrixCity sample on SuperSplat | https://superspl.at/scene/ace6e5b0 | large-scale | Public GS scene of "small city aerial" | Per page | Single-click large-scale aerial GS to test streaming with. |

Chinese-language hubs (3dgs.cn appears inactive / not found as of 2026-05): primary distribution channels in CN are Bilibili creator pages, Baidu Netdisk links inside paper repos (e.g. CityGaussian, MatrixCity), and a few WeChat-group-shared OneDrive mirrors. No reliable CDN-grade hub identified.

---

## 3. Released GS reconstructions of harsh / large-scale environments

This is the highest-signal section for the project. Most "harsh" GS work is research-paper-attached; download paths are usually a Baidu Netdisk, a Google Drive, or a HuggingFace mirror.

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| Mill19 (Building + Rubble) — Mega-NeRF source | https://meganerf.cmusatyalab.org/ | outdoor-unstructured, large-scale | Original images + COLMAP; `ns-download-data mill19` via Nerfstudio retrains as GS | CMU research license | Rubble scene is literally a construction-debris field; one of the closest fits to "rubble navigation" published. No pre-trained PLY canonically released — must train (or find community PLY on HF). |
| MatrixCity | https://city-super.github.io/matrixcity/ | large-scale | Images + poses; download via HuggingFace / OpenXLab / Baidu | Research (UC) | Synthetic city; aerial + street splits. Used as standard large-scale GS benchmark. Sample splat on SuperSplat (see §2). |
| CityGaussian / CityGaussianV2 | https://dekuliutesla.github.io/citygs/ • https://dekuliutesla.github.io/CityGaussianV2/ | large-scale | Code + checkpoints on GitHub `Linketic/CityGaussian`; trained on Mill19, MatrixCity, UrbanScene3D | Research | Released checkpoints can be exported to PLY. Closest "drop-in large-scale GS city" with reproducible artifacts. |
| Horizon-GS | https://city-super.github.io/horizon-gs/ • https://github.com/InternRobotics/HorizonGS | large-scale | Code + eval on MatrixCity Block_Small / Block_A | Research | Aerial-to-ground unified GS; eval splats potentially exportable. |
| SplatCo | https://github.com/SCUT-BIP-Lab/SplatCo | large-scale, outdoor-unstructured | Code; evaluated on 13 large outdoor scenes including MatrixCity | Research | Reference for what large-scale outdoor GS state-of-art looks like. |
| GauU-Scene | https://saliteta.github.io/CUHKSZ_SMBU/ | large-scale | Benchmark scene set for large-scale GS reconstruction | Research | Drone-captured campuses; PLY availability via the project page. |
| UrbanScene3D | https://vcc.tech/UrbanScene3D • https://github.com/yilinliu77/UrbanScene3D | large-scale | Aerial photos + meshes; usable to train GS (no canonical PLY drop) | Non-commercial | The other half of the Mega-NeRF benchmark pair. |
| UrbanBIS | https://vcc.tech/UrbanBIS | large-scale | Aerial photos + 3D recon (mesh / point cloud) | Non-commercial | 10.78 km² aerial photogrammetry corpus. Train your own GS from raw imagery. |
| WeatherGS (ICRA 2025) | https://github.com/Jumponthemoon/WeatherGS • https://jumponthemoon.github.io/weather-gs/ | low-visibility | Code + adverse-weather benchmark (rain/snow) | Research | Repo claims a "diverse and challenging benchmark"; check `Releases` for ready splats. |
| DehazeGS | https://arxiv.org/html/2501.03659v6 | low-visibility (fog) | Paper + code referenced | Research | First clear-GS from multi-view foggy images. Source/data on project repo. |
| Gaussian-DK (Gaussian in the Dark) | https://arxiv.org/html/2408.09130v2 | low-visibility (night) | Code + dark-environment benchmark | Research | First 3DGS targeting multi-view night inconsistency. |
| LL-Gaussian | https://arxiv.org/abs/2504.10331 | low-visibility (extreme low light) | Code + low-light dataset | Research | Authors release a real-world low-light scene set. |
| Luminance-GS | https://cuiziteng.github.io/Luminance_GS_web/ | low-visibility (mixed lighting) | Code | Research | Per-view color adaptation; checkpoints likely on project page. |
| NTR-Gaussian | https://openaccess.thecvf.com/content/CVPR2025/papers/Yang_NTR-Gaussian_*.pdf | low-visibility (thermal night) | Paper; code link inside | Research | Nighttime *thermal* 4D reconstruction — niche but on-target. |
| LiDAR-Guided GS for Mine Tunnel | https://www.mdpi.com/2072-4292/18/9/1386 | indoor-degraded (mine tunnel) | Paper; check linked repo for data | Research | Explicit mine-tunnel GS, with UDF regularisation. Closest public tunnel-GS work. |
| GTS-SLAM (Underground Mines) | published in MDPI Vehicles 2026 — search "GTS-SLAM GICP 3D Gaussian Splatting" | indoor-degraded | Paper; code per release | Research | Dense SLAM + GS in mines; possible data release in code repo. |
| Splatblox (outdoor robot nav) | https://arxiv.org/html/2511.18525v1 | outdoor-unstructured | Code; vegetation/cluttered eval | Research | RGB+LiDAR traversability GS for forest-like environments. |
| Zero-Shot UAV Nav in Forests (Relightable GS) | https://arxiv.org/abs/2602.07101 | outdoor-unstructured | Paper; code via project page | Research | Forest GS for UAV nav benchmark — check for released splats. |
| Ground4D (off-road) | https://arxiv.org/abs/2605.04435 | outdoor-unstructured | Paper / code link | Research | Spatially-grounded feedforward 4D recon of off-road scenes. |
| GS-SDF (HKU MARS lab) | https://github.com/hku-mars/GS-SDF | outdoor-unstructured, indoor-degraded | LiDAR+GS reconstruction; release of trained scenes per IROS 2025 | Research | One of the few GS releases tied to robotics LiDAR rigs. |
| LAMP 2.0 benchmark | referenced via https://arxiv.org/html/2510.23988v1 (collab SLAM survey) | indoor-degraded | Multi-robot maps across DARPA SubT environments | Research | Source LiDAR-image data for training tunnel/urban-degraded GS. |
| HoloGS (HoloLens 2 GS) | https://arxiv.org/abs/2405.02005 | indoor-general | Paper + code | Research | Useful pattern for fast GS from depth-sensor passes in degraded interiors. |
| Lunar GS (Artemis II) | https://superspl.at/ (search "Moon") • https://www.sciencedirect.com/science/article/abs/pii/S2213133725000265 | outdoor-unstructured (planetary analog) | Public splat; ScienceDirect paper for full methodology | NASA-derived | Strong Mars/lunar analog content. |

Note: many "harsh GS" papers release code+images but not pre-trained `.ply` — you will usually train. Wherever a paper provides only paper+repo, no entry here means there's no fetchable splat file you can hand to Spark today.

---

## 4. Source image/video datasets to train your own GS

These are NOT pre-made GS — they are the raw inputs you'd feed Postshot / Brush / gsplat / Splatfacto to get a splat.

### 4a. Outdoor unstructured

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| RELLIS-3D | http://www.unmannedlab.org/research/RELLIS-3D • https://github.com/unmannedlab/RELLIS-3D | outdoor-unstructured | ROS bags: RGB, stereo, 3D LiDAR, GPS, IMU | Research | TAMU off-road campus; standard off-road perception baseline. |
| RUGD | http://rugd.vision/ (linked from RELLIS) | outdoor-unstructured | RGB video + semantic labels | Research | Original off-road semantic seg corpus that RELLIS extends. |
| ROOAD | https://github.com/unmannedlab/ROOAD | outdoor-unstructured | RELLIS off-road odometry sequences | Research | Pose + imagery; suitable for COLMAP-free GS pipelines. |
| TartanAir | https://theairlab.org/tartanair-dataset/ | outdoor-unstructured (synthetic) | Photo-real Unreal sequences | Research | 20 environments incl. forest, harsh weather, abandoned facilities. Synthetic but GS-friendly camera coverage. |
| TartanGround | https://arxiv.org/html/2505.10696v2 | outdoor-unstructured | Large-scale ground-robot dataset | Research | Newer (2025); ground-robot extension of TartanAir family. |
| Wild-Places (CSIRO) | https://csiro-robotics.github.io/Wild-Places/ • https://github.com/csiro-robotics/Wild-Places | outdoor-unstructured | Handheld LiDAR sequences, 14 months, forest | Research | LiDAR-heavy; pair with separately collected RGB for GS, or use for LiDAR-init GS pipelines. |
| CODa (UT Campus Object Dataset) | https://dataverse.tdl.org/dataset.xhtml?persistentId=doi:10.18738/T8/BBOQMV | outdoor-general (campus, some unstructured) | Egocentric robot perception | TDL terms | Useful but mostly structured campus. |

### 4b. Indoor degraded / subterranean

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| DARPA SubT — MARBLE Finals | https://arpg.github.io/marble/ | indoor-degraded | Ouster OS1-64 LiDAR, IMU, RGB from Kentucky Megacavern | Research | The canonical SubT Finals dataset. |
| DARPA SubT — Team CERBERUS (ETH) | https://github.com/leggedrobotics/cerberus_darpa_subt_datasets | indoor-degraded | ANYmal C onboard sensors from winning Finals run | Research | Quadruped-mounted; matches your MuJoCo robot context. |
| SubT Resources index | https://github.com/subtchallenge/subt_resources/blob/main/3-Datasets.md | indoor-degraded | Catalog of SubT team data drops | Mixed | Best meta-index for SubT data hunting. |
| Team MARBLE ColoRadar | https://arpg.github.io/coloradar/ | indoor-degraded | mmWave radar + LiDAR + IMU in mines and built env. | Research | Radar-primary; complements RGB-light pipelines. |
| Hilti SLAM Challenge 2022/2023 | https://hilti-challenge.com/ • https://github.com/Hilti-Research/hilti-slam-challenge-2022 | indoor-degraded | LiDAR + visual + IMU, construction sites | Research / challenge | Construction interiors, parking, labs. |
| Hilti-Trimble SLAM Challenge 2026 | https://github.com/Hilti-Research/hilti-trimble-slam-challenge-2026 | indoor-degraded | 360 visual-inertial + floor plan priors | Research | Newest in the Hilti series. |
| Newer College Dataset | https://ori-drs.github.io/newer-college-dataset/ | indoor/outdoor mixed | Handheld LiDAR-visual-inertial | Research | Standard SLAM benchmark; some degraded coverage. |
| ConSLAM | https://github.com/mac137/ConSLAM | indoor-degraded | Construction SLAM dataset | Research | Construction site sequences. |
| FusionPortable | https://fusionportable.github.io/ | mixed | Multi-sensor mobile robot dataset | Research | LiDAR + stereo RGB + event + IMU + GPS. |

### 4c. Low-visibility / adverse weather

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| Oxford RobotCar | https://robotcar-dataset.robots.ox.ac.uk/ | low-visibility | Repeated route across seasons / night / rain / snow | Research | First-of-kind adverse-weather driving dataset. No semantic labels. |
| Boreas | https://www.boreas.utias.utoronto.ca/ | low-visibility, large-scale | 350 km, multi-season, rain/snow, 128-line LiDAR + radar + 5MP cam | Research | Strong winter/seasonal coverage; cm-accurate poses help GS. |
| ACDC | https://acdc.vision.ee.ethz.ch/ | low-visibility | 4006 images: fog/night/rain/snow + clear correspondences + semantic labels | Research | Pixel-aligned clear↔adverse pairs — useful for adverse-cond GS supervision. |
| nuScenes | https://www.nuscenes.org/ | low-visibility | Multimodal driving, ~11.6% night + 19.4% rain | Free for research | Large; cherry-pick night/rain keyframes. |
| BDD100K | https://bdd-data.berkeley.edu/ | low-visibility | 100k driving sequences with time-of-day + weather attributes | Research | Filter for `night` / `rainy`. |
| Foggy Cityscapes | https://www.cityscapes-dataset.com/ (see "Foggy" addendum) | low-visibility | Synthetic fog over Cityscapes | Research | Synthetic but useful for fog-augmentation. |
| OORD (Oxford Off-road Radar) | https://arxiv.org/html/2403.02845v1 | outdoor-unstructured + low-visibility | Radar primary | Research | Off-road + adverse; radar-heavy. |
| WeatherGS benchmark (in §3) | https://github.com/Jumponthemoon/WeatherGS | low-visibility | Source images for the benchmark scenes | Research | Listed for completeness as a *training* source too. |
| Gaussian-DK night benchmark | https://arxiv.org/html/2408.09130v2 | low-visibility | Source images released with paper | Research | Real-world dark captures. |
| LL-Gaussian low-light scenes | https://arxiv.org/abs/2504.10331 | low-visibility | Source images released with paper | Research | Extreme low-light multi-view. |

### 4d. Large-scale / city / aerial

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| Mill19 imagery (Mega-NeRF source) | https://meganerf.cmusatyalab.org/ | large-scale, outdoor-unstructured | Raw aerial imagery + COLMAP | Research | Already mentioned in §3; lives here too as a training source. |
| UrbanScene3D imagery | https://vcc.tech/UrbanScene3D | large-scale | Aerial drone footage | Non-commercial | Pair with Mill19 for the standard large-scale GS pair. |
| UrbanBIS imagery | https://vcc.tech/UrbanBIS | large-scale | 113k aerial photos, 10.78 km² | Non-commercial | The largest urban photogrammetry corpus on this list. |
| MatrixCity source | https://city-super.github.io/matrixcity/ | large-scale | Synthetic city renders + poses | Research | Synthetic, but lossless poses help. |
| KITTI-360 | https://www.cvlibs.net/datasets/kitti-360/ | large-scale, urban | 320k images + 100k laser scans, 73.7 km | Research | Standard urban GS source. |
| Waymo Block-NeRF data | https://waymo.com/research/block-nerf/ | large-scale, urban | ~12,000 images, 12 cameras, 100 s | Waymo terms | The data behind Block-NeRF; suitable for block-GS recon. |
| Waymo Open Dataset | https://waymo.com/open/ | large-scale | Full multi-camera autonomous-driving corpus | Waymo terms | Filter for relevant adverse-condition logs. |

---

## 5. Open-source GS tooling (viewers, converters, trainers)

| Name | URL | Env fit | Format / access | License | Notes |
|---|---|---|---|---|---|
| Spark (sparkjsdev) | https://github.com/sparkjsdev/spark • https://sparkjs.dev/docs/ | n/a | Three.js renderer; eats `.ply`/`.spz`/`.splat`/`.ksplat`/`.sog`/`.zip`/`.rad` from URL | MIT (per repo) | Already in use in the project. |
| SuperSplat editor | https://superspl.at/editor • https://github.com/playcanvas/supersplat | n/a | Browser editor: clean / crop / re-orient / compress; exports `.ply` / `.compressed.ply` / `.sog` | MIT | Single most useful asset-prep tool for prepping harsh-env splats for streaming. |
| gsplat (Nerfstudio) | https://github.com/nerfstudio-project/gsplat | n/a | CUDA rasterization + training | Apache-2.0 | Faster + lighter than INRIA reference. Recommended trainer. |
| Nerfstudio Splatfacto | https://docs.nerf.studio/nerfology/methods/splat.html | n/a | Full pipeline (data → train → export PLY) | Apache-2.0 | Easiest end-to-end CLI. `ns-download-data mill19` works. |
| Splatfacto-W | https://kevinxu02.github.io/splatfactow/ • https://arxiv.org/abs/2407.12306 | low-visibility (variable lighting) | Nerfstudio variant for unconstrained photo collections | Research | Handles inconsistent exposure — relevant to adverse-light scenes. |
| Brush (ArthurBrussee) | https://github.com/ArthurBrussee/brush | n/a | Cross-platform (incl. WebGPU browser) GS trainer in Rust/Burn | Apache-2.0 | Trains on a phone or in a browser. Useful for field labs. |
| INRIA reference 3DGS | https://github.com/graphdeco-inria/gaussian-splatting | n/a | Original CUDA implementation | Research / non-commercial | Reference impl; commercial-restricted. |
| antimatter15 splat viewer | https://github.com/antimatter15/splat • https://antimatter15.com/splat/ | n/a | WebGL viewer | MIT | Auto-converts dropped `.ply` → `.splat`. Good debugging fallback. |
| GaussianSplats3D (mkkellogg) | https://github.com/mkkellogg/GaussianSplats3D | n/a | Three.js renderer; defines `.ksplat` | MIT | Spark reads `.ksplat`; this is the canonical producer. |
| gsplat.js (huggingface) | https://github.com/huggingface/gsplat.js | n/a | JS GS library | Apache-2.0 | Lightweight alternative web renderer. |
| Niantic spz | https://github.com/nianticlabs/spz | n/a | C++ encoder/decoder for `.spz`; browser tool at https://nianticlabs.github.io/spz | MIT | `.spz` ↔ `.ply` inspection + conversion. SPZ 4 (NGSP magic, May 2026) is the latest. |
| spz-to-ply (web) | https://spz-to-ply.netlify.app/ | n/a | Browser converter | n/a | Quick ad-hoc conversion (e.g. for Marble exports). |
| Jackneill/spz (Rust/Python) | https://github.com/Jackneill/spz | n/a | Rust + Python spz tooling + CLI | MIT | If you want spz in your build pipeline. |
| splat3d / SOG / compressed PLY | https://playcanvas.com/products/supersplat (docs) | n/a | Compression format docs | MIT | Useful for understanding the `.sog` and compressed-PLY paths Spark accepts. |
| gaussian-splatting-lightning | https://github.com/yzslab/gaussian-splatting-lightning | n/a | Aggregator framework + web viewer | Apache-2.0 | Aggregates derived algorithms (low-light, sparse-view, large-scale) in one trainer. |
| 3DGS.cpp | https://github.com/shg8/3dgs_cpp | n/a | Cross-platform Vulkan-Compute renderer (Win/macOS/Linux/iOS/visionOS) | MIT | Native viewer reference, useful for desktop validation. |
| splatviz | https://github.com/Florian-Barthel/splatviz | n/a | Live-editable rendering code viewer | MIT | Good for debugging shader paths. |
| vkgs | https://github.com/jaesung-cs/vkgs | n/a | Vulkan renderer | MIT | Fast desktop reference. |

---

## 6. Communities & ongoing-release channels to monitor

- **RadianceFields.com** — https://radiancefields.com/ and the Substack newsletter https://radiancefields.substack.com/ — primary editorial coverage of new GS releases.
- **MrNeRF awesome list (live)** — https://github.com/MrNeRF/awesome-3D-gaussian-splatting — most reliable single page to scan weekly.
- **longxiang-ai daily arxiv tracker** — https://github.com/longxiang-ai/awesome-gaussians — auto-updated; catches papers before they hit the curated list.
- **Lee-JaeWon paper list** — https://github.com/Lee-JaeWon/2025-Arxiv-Paper-List-Gaussian-Splatting — Korean researcher's daily-updated arxiv list.
- **3DGS_and_Beyond_Docs (CN-leaning index)** — https://github.com/yangjiheng/3DGS_and_Beyond_Docs — picks up Chinese-side releases first.
- **Awesome3DGS / qqqqqqy0227 awesome-3DGS** — https://github.com/Awesome3DGS/3D-Gaussian-Splatting-Papers • https://github.com/qqqqqqy0227/awesome-3DGS — paper indexes with CN annotations.
- **Awesome NeRF-and-3DGS-SLAM** — https://github.com/3D-Vision-World/awesome-NeRF-and-3DGS-SLAM — the right list for the robotics intersection (SLAM + GS in degraded environments).
- **Awesome-Computer-Vision-Adverse-Weather** — https://github.com/sunshangquan/Awesome-Computer-Vision-Adverse-Weather — for the low-visibility track specifically.
- **Awesome-3D-LiDAR-Datasets (minwoo0611)** — https://github.com/minwoo0611/Awesome-3D-LiDAR-Datasets — broad dataset index, including SubT-style.
- **SubT Resources** — https://github.com/subtchallenge/subt_resources — meta-index of all SubT team data drops.
- **Spark GitHub Discussions** — https://github.com/sparkjsdev/spark/discussions — for renderer-side compatibility / streaming questions.
- **PlayCanvas SuperSplat Discord** — invite via https://playcanvas.com/products/supersplat — community for asset-side issues.
- **World Labs blog** — https://www.worldlabs.ai/blog — Marble + Spark changelog.
- **Niantic Spatial blog** — https://www.nianticspatial.com/en/blog — SPZ format updates, Scaniverse releases.
- **Hugging Face — datasets filter for `gaussian-splatting`** — https://huggingface.co/datasets?other=gaussian-splatting — monitor for new public GS dataset drops.
- **r/GaussianSplatting** — https://www.reddit.com/r/GaussianSplatting/ — community Q&A; lower signal than the lists but catches consumer-side captures.
- **SIGGRAPH Asia 2025 3DGS Challenge** — https://gaplab.cuhk.edu.cn/projects/gsRaceSIGA2025/ — challenge releases tend to include source data.

---

## 7. Gaps & open questions

These are explicit holes found during this survey — chase separately:

- **No public, pre-trained GS reconstruction of a SubT-style tunnel** as of 2026-05. The mine-tunnel paper (MDPI Remote Sensing 18/9/1386) exists but pre-trained PLY release is not documented. GTS-SLAM (MDPI Vehicles 2026) same situation. You will need to train on MARBLE / CERBERUS / Hilti raw data yourself.
- **No public GS reconstruction of debris-filled / collapsed building scenes.** Mill19-Rubble is the closest analog (construction-debris field, outdoor, aerial perspective) — not the indoor-collapsed-building scenario.
- **No public GS dataset specifically for smoke / dust** found in searches; rain, fog, snow, and night are covered, but smoke/dust/sandstorm appears to be an unfilled niche.
- **Polycam / Luma / Scaniverse CDN stability for raw splats**: none of these vendors publish a stable, documented public URL pattern for the underlying `.ply`/`.spz` asset. Embedded viewers fetch them, but relying on that is fragile. World Labs Marble is the exception (Spark 2.0 integration is intended for direct streaming).
- **Marble world-search for harsh content**: there is no documented categorical / tag-based filter for users to find "rubble" or "tunnel" Marble worlds; harsh-env content discoverability is poor.
- **`.luma` interactive scenes** are not Spark-compatible; require an export step.
- **MatrixCity etc. are synthetic** — domain gap to real harsh terrain is real. Treat as augmentation, not ground truth.
- **License heterogeneity**: most academic harsh-env datasets (Mill19, UrbanScene3D, UrbanBIS, MatrixCity, Wild-Places, RELLIS-3D, ACDC, SubT team data) are non-commercial / research-only. If the user's downstream is commercial, almost all of §3 and §4 need re-licensing or in-house recapture.
- **Mars / planetary analog**: only the Artemis II Moon splat surfaces. No public Mars Yard / JPL Mars Yard GS. Possibly worth contacting JPL / DLR.
- **Aerial off-road forest GS**: forest UAV nav papers exist (`2602.07101`, Splatblox) but consolidated public splat releases for forest scenes are scarce. Likely needs train-it-yourself.

### Recommended next steps

- Probe Marble's CDN URL pattern (the project already does this) — confirm whether private-link worlds expose stable HTTPS for arbitrary worlds, or only via Spark's loader.
- For "rubble" demos today, Mill19-Rubble via Mega-NeRF + a one-time Splatfacto/gsplat training run is the highest-fidelity option. No re-training needed if a community PLY exists on HuggingFace — search `mill19 rubble` there before training.
- For tunnel demos, train on MARBLE Finals or CERBERUS sequences with Brush or Splatfacto; budget GPU time (Kentucky Megacavern run is large).
- For adverse-weather demos, start with WeatherGS or Gaussian-DK pretrained scenes if released; fallback is to train Splatfacto-W on ACDC night/rain subsets.
- Subscribe to the RadianceFields newsletter + watch `MrNeRF/awesome-3D-gaussian-splatting` and `3D-Vision-World/awesome-NeRF-and-3DGS-SLAM` repos — they catch the harsh-env releases earliest.
- Run a one-off test fetching a public SuperSplat scene's underlying asset URL through the project's Vite/COOP-COEP proxy to confirm Spark loads it directly (validates SuperSplat as a backup CDN if Marble is down).
