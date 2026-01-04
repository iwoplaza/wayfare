To allow for putting custom game code between steps that the engine performs each render frame (or each physics frame),
it might make sense to explore Pmndr's solution for scheduling. That way, tasks can be inserted before or after default
scheduled steps with ease (hopefully).

It might also make sense to reexport koota through wayfare, but I kind of like that transparency.
