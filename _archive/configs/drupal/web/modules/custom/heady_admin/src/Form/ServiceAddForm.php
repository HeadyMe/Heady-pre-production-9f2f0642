<?php

namespace Drupal\heady_admin\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Database\Connection;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Form for adding a new service.
 */
class ServiceAddForm extends FormBase {

  /**
   * The database connection.
   *
   * @var \Drupal\Core\Database\Connection
   */
  protected $database;

  /**
   * Constructs a ServiceAddForm object.
   *
   * @param \Drupal\Core\Database\Connection $database
   *   The database connection.
   */
  public function __construct(Connection $database) {
    $this->database = $database;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('database')
    );
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'heady_admin_service_add_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $form['service_name'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Service Name'),
      '#required' => TRUE,
      '#description' => $this->t('Enter the name of the service'),
    ];

    $form['service_type'] = [
      '#type' => 'select',
      '#title' => $this->t('Service Type'),
      '#options' => [
        'frontend' => $this->t('Frontend'),
        'backend' => $this->t('Backend'),
        'database' => $this->t('Database'),
        'api' => $this->t('API'),
        'cms' => $this->t('CMS'),
      ],
      '#required' => TRUE,
    ];

    $form['domain'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Domain'),
      '#description' => $this->t('example.headysystems.com'),
      '#required' => TRUE,
    ];

    $form['port'] = [
      '#type' => 'number',
      '#title' => $this->t('Port'),
      '#description' => $this->t('Port number (e.g., 3000)'),
      '#required' => TRUE,
      '#min' => 1,
      '#max' => 65535,
    ];

    $form['actions']['submit'] = [
      '#type' => 'submit',
      '#value' => $this->t('Add Service'),
      '#button_type' => 'primary',
    ];

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $values = $form_state->getValues();
    
    // Save service to database
    $this->database->insert('heady_admin_services')
      ->fields([
        'service_name' => $values['service_name'],
        'service_type' => $values['service_type'],
        'domain' => $values['domain'],
        'port' => $values['port'],
        'status' => 'pending',
        'created' => time(),
      ])
      ->execute();

    $this->messenger()->addStatus($this->t('Service %service has been added successfully.', ['%service' => $values['service_name']]));
    
    $form_state->setRedirect('heady_admin.services');
  }

}
