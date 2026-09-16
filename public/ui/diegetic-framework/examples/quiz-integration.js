/**
 * quiz-integration.js
 * ---------------------------------------------------------
 * EXEMPLE de com connectar el DiegeticWorld amb la lògica
 * d'un joc de preguntes que ja existeix.
 *
 * Idea clau: aquest fitxer és la ÚNICA part que coneix tant
 * l'escena 3D com la lògica del joc. Ni DiegeticWorld sap
 * què és una "pregunta", ni QuizGame (el vostre codi ja fet)
 * hauria de necessitar saber què és un waypoint de càmera.
 *
 * Substituïu `QuizGame` per la vostra classe/mòdul real.
 * L'única cosa que cal és que QuizGame emeti/rebi events
 * compatibles (o hi afegim un petit adaptador aquí mateix).
 * ---------------------------------------------------------
 */

import { DiegeticWorld } from '../src/index.js';
// import { QuizGame } from '../../game/QuizGame.js'; // <-- el vostre joc real

async function main() {
  const world = new DiegeticWorld({
    container: document.getElementById('scene-container'),
    assetBasePath: '/assets/models/',
    debug: true, // treure a producció
  });

  // ---------------------------------------------------------
  // 1. Carreguem els assets de l'escena
  // ---------------------------------------------------------
  await world.loadAsset('room', 'quiz_room.glb');
  await world.loadAsset('podium', 'podium.glb', {
    position: [0, 0, -2],
    toon: true,
    toonOptions: { bands: 3, rimPower: 2.0 },
    outline: true,
    outlineOptions: { thickness: 0.015 },
  });
  await world.loadAsset('answer_button_a', 'answer_button.glb', {
    position: [-1.5, 0.9, -1],
    toon: true,
    outline: true,
  });
  await world.loadAsset('answer_button_b', 'answer_button.glb', {
    position: [1.5, 0.9, -1],
    toon: true,
    outline: true,
  });

  // ---------------------------------------------------------
  // 2. Definim els punts de vista de la càmera
  // ---------------------------------------------------------
  world.addCameraWaypoint('intro', {
    position: [0, 1.6, 5],
    lookAt: [0, 1, 0],
  });
  world.addCameraWaypoint('question_view', {
    position: [0, 1.4, 2.2],
    lookAt: [0, 0.9, -1],
  });
  world.addCameraWaypoint('answer_a_closeup', {
    position: [-1.2, 1.1, 0.5],
    lookAt: [-1.5, 0.9, -1],
  });

  world.cameraRig.jumpTo('intro'); // posició inicial sense animació

  // ---------------------------------------------------------
  // 3. Marquem què és interactuable
  // ---------------------------------------------------------
  world.makeInteractive('answer_button_a', 'select_answer', { payload: { answerId: 'A' } });
  world.makeInteractive('answer_button_b', 'select_answer', { payload: { answerId: 'B' } });

  // ---------------------------------------------------------
  // 4. Pont amb la lògica del joc
  //
  //    Aquí és on connecteu el vostre QuizGame real. El patró:
  //    - L'escena emet "interact:select_answer" quan es toca un botó
  //    - Ho traduïm a una crida al vostre joc (quiz.submitAnswer(...))
  //    - El vostre joc, quan sap si és correcte, crida a l'escena
  //      per animar/moure la càmera com pertoqui
  // ---------------------------------------------------------

  // const quiz = new QuizGame(/* ... */);

  world.on('interact:select_answer', ({ payload }) => {
    console.log('Resposta seleccionada:', payload.answerId);

    // Feedback immediat a l'escena, independent del resultat:
    world.moveCameraTo(
      payload.answerId === 'A' ? 'answer_a_closeup' : 'question_view',
      { duration: 0.8 }
    );

    // Exemple de crida real al joc (descomentar quan hi hagi QuizGame):
    // const isCorrect = quiz.submitAnswer(payload.answerId);
    // world.emit(isCorrect ? 'game:correctAnswer' : 'game:wrongAnswer', payload);
  });

  // El joc "parla" a l'escena via events amb prefix "game:"
  world.on('game:correctAnswer', () => {
    world.playAnimation('podium', 'CorrectFlash', { loop: false });
    world.moveCameraTo('intro', { duration: 1.5 });
  });

  world.on('game:wrongAnswer', () => {
    world.playAnimation('podium', 'WrongShake', { loop: false });
  });

  // ---------------------------------------------------------
  // 5. Engeguem el render loop
  // ---------------------------------------------------------
  world.start();

  // Per fer proves sense el joc real connectat:
  window.__world = world; // inspeccionable des de la consola
}

main().catch(console.error);
