<?php

function allow_glb_upload($mime_types)
{
    $mime_types['glb'] = 'model/gltf-binary';
    return $mime_types;
}
add_filter('upload_mimes', 'allow_glb_upload');
