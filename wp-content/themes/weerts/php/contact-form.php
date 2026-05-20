<?php

function output_questions_data()
{
    $questions = get_field('questions', 61);

    if (!$questions) return;

    $formatted = array();
    foreach ($questions as $q) {
        $question = array(
            'id' => $q['id'],
            'title' => $q['title'],
            'type' => $q['type']
        );

        if ($q['type'] === 'single' && $q['options']) {
            $question['options'] = array_map('trim', explode("\n", $q['options']));
        }

        if ($q['type'] === 'conditional' && $q['conditional_rules']) {
            $conditions = array();
            foreach ($q['conditional_rules'] as $rule) {
                $trigger = $rule['trigger_value'];
                $options = array_map('trim', explode("\n", $rule['show_options']));
                $conditions[$trigger] = $options;
            }
            $question['conditions'] = $conditions;
        }

        if ($q['type'] === 'slider' && $q['slider_rules']) {
            $slider_config = array();
            foreach ($q['slider_rules'] as $rule) {
                $slider_config[$rule['slider_trigger']] = array(
                    'min' => (int)$rule['slider_min'],
                    'max' => (int)$rule['slider_max'],
                    'step' => (int)$rule['slider_step'],
                    'hide' => (bool)$rule['slider_hide']
                );
            }
            $question['slider_config'] = $slider_config;
        }

        $formatted[] = $question;
    }

    echo '<script id="questionsData" type="application/json">' . json_encode($formatted) . '</script>';
}

// Use in your template
add_action('wp_footer', 'output_questions_data');
