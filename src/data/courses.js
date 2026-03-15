// WGU BS Finance degree plan (BSFIN 202304)
// 40 courses, 120 CUs
// type: OA = Objective Assessment, PA = Performance Assessment
export const COURSES = [
  // General Education (10)
  { id: 'd265', code: 'D265', name: 'Critical Thinking: Reason and Evidence', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'd269', code: 'D269', name: 'Composition: Writing with a Strategy', cus: 3, type: 'PA', category: 'General Education' },
  { id: 'c955', code: 'C955', name: 'Applied Probability and Statistics', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'c957', code: 'C957', name: 'Applied Algebra', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'd198', code: 'D198', name: 'Global Arts and Humanities', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'd268', code: 'D268', name: 'Introduction to Communication: Connecting with Others', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'c458', code: 'C458', name: 'Health, Fitness, and Wellness', cus: 4, type: 'OA', category: 'General Education' },
  { id: 'c165', code: 'C165', name: 'Integrated Physical Sciences', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'c273', code: 'C273', name: 'Introduction to Sociology', cus: 3, type: 'OA', category: 'General Education' },
  { id: 'd267', code: 'D267', name: 'US History: Stories of American Democracy', cus: 3, type: 'OA', category: 'General Education' },

  // Business Core (21)
  { id: 'c715', code: 'C715', name: 'Organizational Behavior', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd072', code: 'D072', name: 'Fundamentals for Success in Business', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd082', code: 'D082', name: 'Emotional and Cultural Intelligence', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'c717', code: 'C717', name: 'Business Ethics', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd196', code: 'D196', name: 'Principles of Financial and Managerial Accounting', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd253', code: 'D253', name: 'Values-Based Leadership', cus: 3, type: 'PA', category: 'Business Core' },
  { id: 'd351', code: 'D351', name: 'Functions of Human Resource Management', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd388', code: 'D388', name: 'Fundamentals of Spreadsheets and Data Presentations', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd081', code: 'D081', name: 'Innovative and Strategic Thinking', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'c723', code: 'C723', name: 'Quantitative Analysis for Business', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd078', code: 'D078', name: 'Business Environment Applications I', cus: 2, type: 'PA', category: 'Business Core' },
  { id: 'd076', code: 'D076', name: 'Finance Skills for Managers', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'c483', code: 'C483', name: 'Principles of Management', cus: 4, type: 'OA', category: 'Business Core' },
  { id: 'd075', code: 'D075', name: 'Information Technology Management Essentials', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd079', code: 'D079', name: 'Business Environment Applications II', cus: 2, type: 'PA', category: 'Business Core' },
  { id: 'd077', code: 'D077', name: 'Concepts in Marketing, Sales, and Customer Contact', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd089', code: 'D089', name: 'Principles of Economics', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd352', code: 'D352', name: 'Employment and Labor Law', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'c720', code: 'C720', name: 'Operations and Supply Chain Management', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'c722', code: 'C722', name: 'Project Management', cus: 3, type: 'OA', category: 'Business Core' },
  { id: 'd080', code: 'D080', name: 'Managing in a Global Business Environment', cus: 3, type: 'OA', category: 'Business Core' },

  // Finance Major (8)
  { id: 'd363', code: 'D363', name: 'Personal Finance', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd366', code: 'D366', name: 'Financial Statement Analysis', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd216', code: 'D216', name: 'Business Law for Accountants', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd362', code: 'D362', name: 'Corporate Finance', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd364', code: 'D364', name: 'Financial Management I', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd365', code: 'D365', name: 'Financial Management II', cus: 3, type: 'OA', category: 'Finance Major' },
  { id: 'd368', code: 'D368', name: 'Enterprise Risk Management', cus: 3, type: 'PA', category: 'Finance Major' },
  { id: 'd367', code: 'D367', name: 'Innovation in Finance', cus: 3, type: 'PA', category: 'Finance Major' },

  // Capstone (1)
  { id: 'd369', code: 'D369', name: 'Finance Capstone', cus: 3, type: 'PA', category: 'Capstone' },
];

export const TOTAL_CUS = COURSES.reduce((sum, c) => sum + c.cus, 0);
